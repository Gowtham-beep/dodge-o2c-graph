import Groq from 'groq-sdk';

const SYSTEM_PROMPT = `
You are a data analyst for a SAP Order-to-Cash ERP system.
You have access to the following PostgreSQL tables:

sales_order_headers: salesOrder(PK), salesOrderType, soldToParty,
  totalNetAmount, overallDeliveryStatus, overallOrdReltdBillgStatus,
  overallSdDocReferenceStatus, creationDate, requestedDeliveryDate,
  transactionCurrency, headerBillingBlockReason, deliveryBlockReason

sales_order_items: salesOrder, salesOrderItem, material,
  requestedQuantity, requestedQuantityUnit, netAmount, productionPlant

sales_order_schedule_lines: salesOrder, salesOrderItem, scheduleLine,
  confirmedDeliveryDate, confdOrderQtyByMatlAvailCheck

outbound_delivery_headers: deliveryDocument(PK), actualGoodsMovementDate,
  overallGoodsMovementStatus, overallPickingStatus, shippingPoint

outbound_delivery_items: deliveryDocument, deliveryDocumentItem,
  referenceSdDocument, actualDeliveryQuantity, plant, storageLocation

billing_document_headers: billingDocument(PK), billingDocumentType,
  totalNetAmount, billingDocumentIsCancelled, cancelledBillingDocument,
  accountingDocument, soldToParty, creationDate, transactionCurrency

billing_document_items: billingDocument, billingDocumentItem, material,
  billingQuantity, netAmount, referenceSdDocument

billing_document_cancellations: billingDocument(PK),
  cancelledBillingDocument, accountingDocument, soldToParty

journal_entry_items: accountingDocument, accountingDocumentItem,
  fiscalYear, referenceDocument, customer, amountInTransactionCurrency,
  transactionCurrency, postingDate, clearingDate

payments: accountingDocument, accountingDocumentItem, fiscalYear,
  customer, invoiceReference, salesDocument,
  amountInTransactionCurrency, transactionCurrency, clearingDate

business_partners: businessPartner(PK), businessPartnerName,
  customer, industry

products: product(PK), productGroup, division
product_descriptions: product, language, productDescription
plants: plant(PK), plantName

KEY JOINS (O2C flow):
- sales_order_items."salesOrder" = sales_order_headers."salesOrder"
- outbound_delivery_items."referenceSdDocument" = sales_order_headers."salesOrder"
- billing_document_items."referenceSdDocument" = sales_order_headers."salesOrder"
- billing_document_headers."accountingDocument" = journal_entry_items."accountingDocument"
- payments."invoiceReference" = billing_document_headers."billingDocument"
- business_partners."businessPartner" = sales_order_headers."soldToParty"

STATUS CODES in overallDeliveryStatus / overallOrdReltdBillgStatus:
  'A' = not yet started
  'B' = partially processed
  'C' = fully processed

STRICT RULES:
1. For ANY question unrelated to this dataset or SAP O2C domain,
   respond ONLY with this exact JSON:
   {"sql": null, "answer": "This system is designed to answer questions related to the provided dataset only."}

2. For dataset questions respond ONLY with valid JSON:
   {"sql": "SELECT ...", "answer": "Brief explanation of what the query does"}

3. Never fabricate data. All answers must be based on SQL results.
4. Always add LIMIT 100 unless the query is a COUNT or aggregation.
5. For broken flow detection:
   - Delivered not billed: overallDeliveryStatus='C' AND overallOrdReltdBillgStatus != 'C'
   - Billed not delivered: overallOrdReltdBillgStatus='C' AND overallDeliveryStatus != 'C'

CRITICAL SQL RULES — violations will cause runtime errors:
0. Every camelCase identifier must be double-quoted. No exceptions.

0b. Every ID value compared with = must be single-quoted since all IDs are stored as TEXT.
    Example: WHERE "billingDocument" = '90504238'
    Never: WHERE "billingDocument" = 90504238

1. ALL column names MUST be double-quoted: "columnName"
   CORRECT: WHERE "billingDocument" = '90504238'
   WRONG:   WHERE billingDocument = 90504238
   
2. ALL string values MUST be single-quoted: 'value'
   IDs are always TEXT type, never integers.
   CORRECT: WHERE "salesOrder" = '740506'
   WRONG:   WHERE "salesOrder" = 740506

3. Table aliases are fine but column names still need quotes:
   CORRECT: t1."billingDocument"
   WRONG:   t1.billingDocument

4. For material/product queries, billing_document_items 
   already has a "material" column. Use it directly:
   SELECT "material", COUNT("billingDocument") as count 
   FROM billing_document_items 
   GROUP BY "material" ORDER BY count DESC LIMIT 10

5. For node-specific queries like "Tell me about BillingDocument X":
   SELECT * FROM billing_document_headers 
   WHERE "billingDocument" = 'X' LIMIT 1
   
   For OutboundDelivery:
   SELECT * FROM outbound_delivery_headers 
   WHERE "deliveryDocument" = 'X' LIMIT 1
   
   For SalesOrder:
   SELECT * FROM sales_order_headers 
   WHERE "salesOrder" = 'X' LIMIT 1

For tracing the full flow of a document, use a single 
SQL query with JOINs rather than multiple statements.

Example for tracing billing document flow:
SELECT 
  soh."salesOrder",
  soh."soldToParty",
  soh."totalNetAmount",
  soh."overallDeliveryStatus",
  soh."overallOrdReltdBillgStatus",
  bdh."billingDocument",
  bdh."billingDocumentDate",
  bdh."billingDocumentIsCancelled",
  bdh."totalNetAmount" as "billedAmount",
  bdh."accountingDocument",
  ji."postingDate",
  ji."amountInTransactionCurrency",
  p."clearingDate",
  p."amountInTransactionCurrency" as "paidAmount",
  odh."deliveryDocument",
  odh."actualGoodsMovementDate",
  odh."overallGoodsMovementStatus"
FROM billing_document_headers bdh
LEFT JOIN billing_document_items bdi 
  ON bdh."billingDocument" = bdi."billingDocument"
LEFT JOIN sales_order_headers soh 
  ON bdi."referenceSdDocument" = soh."salesOrder"
LEFT JOIN journal_entry_items ji 
  ON bdh."accountingDocument" = ji."accountingDocument"
LEFT JOIN payments p 
  ON bdh."billingDocument" = p."invoiceReference"
LEFT JOIN outbound_delivery_items odi 
  ON soh."salesOrder" = odi."referenceSdDocument"
LEFT JOIN outbound_delivery_headers odh 
  ON odi."deliveryDocument" = odh."deliveryDocument"
WHERE bdh."billingDocument" = '[ID]'
LIMIT 1

Always use this JOIN pattern for flow tracing.
Never use multiple statements separated by semicolons.
Always use single quotes for string values.

CRITICAL: Your response must be a single JSON object only.
No text before or after the JSON.
No nested JSON strings — if the answer contains quotes, escape them properly.
The sql field must be a single-line string with no line breaks inside it.
`;

function extractNodeIds(results, answerText) {
  const ids = new Set()

  // Extract from SQL results
  const idFields = [
    'salesOrder', 'billingDocument', 'deliveryDocument',
    'accountingDocument', 'businessPartner', 'product',
    'plant', 'material', 'invoiceReference',
    'referenceSdDocument', 'soldToParty', 'customer',
    'referenceDocument', 'clearingAccountingDocument'
  ]

  results.forEach(row => {
    idFields.forEach(field => {
      if (row[field] && row[field] !== '') {
        ids.add(String(row[field]))
      }
    })

    // Specifically handle material → product node ID
    if (row['material']) ids.add(String(row['material']))

    // Also check if any value matches a known pattern
    // Product IDs start with S89 or B89 in this dataset
    Object.values(row).forEach(val => {
      if (val && typeof val === 'string') {
        if (val.startsWith('S89') || val.startsWith('B89')) {
          ids.add(val)
        }
      }
    })
  })

  // Extract ENTITY_IDS line from answer text
  if (answerText) {
    const match = answerText.match(/ENTITY_IDS:\s*([^\n]+)/)
    if (match) {
      match[1].split(',').forEach(id => {
        const trimmed = id.trim()
        if (trimmed) ids.add(trimmed)
      })
    }
  }

  return [...ids]
}

function sanitizeSQL(sql) {
  if (!sql) return sql;

  // Fix camelCase columns that are unquoted
  // Simple approach: quote any camelCase word (has uppercase 
  // letter after lowercase) that isn't already quoted
  let fixed = sql.replace(/\b([a-z][a-zA-Z0-9]*[A-Z][a-zA-Z0-9]*)\b/g, (match, p1, offset, string) => {
    // Check if already inside double quotes by looking at char before
    const before = string[offset - 1];
    const after = string[offset + match.length];
    if (before === '"' || after === '"') return match;
    return `"${match}"`;
  });

  return fixed;
}

function parseJSON(text) {
  // Step 1: Remove markdown fences
  let cleaned = text
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  // Step 2: Try direct parse first
  try {
    return JSON.parse(cleaned);
  } catch (e) { }

  // Step 3: Extract first { ... } block
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1) {
    try {
      return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
    } catch (e) { }
  }

  // Step 4: If all parsing fails, treat entire response 
  // as a plain answer with no SQL
  return { sql: null, answer: cleaned };
}

function extractFirstStatement(sql) {
  if (!sql) return sql;
  // Split on semicolons, take first non-empty statement
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);
  return statements[0];
}

export async function handleChat(userMessage, history, client) {
  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const model = 'llama-3.3-70b-versatile';

    let messages = [{ role: 'system', content: SYSTEM_PROMPT }];

    if (history && history.length > 0) {
      let mapped = history.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.text.replace(/\n\[SQL used: .*\]$/, '')
      }));

      // Strip leading assistant messages
      while (mapped.length > 0 && mapped[0].role === 'assistant') {
        mapped.shift();
      }

      // Ensure alternating roles for Groq
      let validHistory = [];
      let expectedRole = 'user';
      for (const msg of mapped) {
        if (msg.role === expectedRole) {
          validHistory.push(msg);
          expectedRole = expectedRole === 'user' ? 'assistant' : 'user';
        }
      }

      // If ends with user, remove last to allow the final user message to be user
      if (validHistory.length > 0 && validHistory[validHistory.length - 1].role === 'user') {
        validHistory.pop();
      }

      messages = messages.concat(validHistory);
    }

    messages.push({ role: 'user', content: userMessage });

    const completion = await groq.chat.completions.create({
      model: model,
      messages: messages,
      temperature: 0.1,
      max_tokens: 1024,
    });

    const responseText = completion.choices[0].message.content;
    const parsed = parseJSON(responseText);

    if (!parsed.sql) {
      return {
        sql: null,
        answer: parsed.answer,
        results: [],
        nodeIds: []
      };
    }

    const sanitizedSQL = sanitizeSQL(parsed.sql);
    const singleSQL = extractFirstStatement(sanitizedSQL);
    console.log('Executing SQL:', singleSQL);

    const queryResult = await client.query(singleSQL);
    let results = queryResult.rows || [];
    console.log(`Query returned ${results.length} rows`);

    // Fetch product names for any material codes in results
    const materialIds = results
      .map(r => r.material)
      .filter(Boolean);

    if (materialIds.length > 0) {
      const namesResult = await client.query(
        `SELECT pd."product", pd."productDescription" 
         FROM product_descriptions pd 
         WHERE pd."product" = ANY($1) 
         AND pd."language" = 'EN'`,
        [materialIds]
      );
      const nameMap = {};
      namesResult.rows.forEach(r => {
        nameMap[r.product] = r.productDescription;
      });

      // Enrich results with product names
      results = results.map(r => ({
        ...r,
        productName: r.material
          ? (nameMap[r.material] || r.material)
          : undefined
      }));
    }

    // Extracted later
    const limitedResults = results.slice(0, 50);

    const followUpMessage = `The SQL query returned ${results.length} rows. Here are the results:
${String(JSON.stringify(limitedResults, null, 0))}

Write a clear, business-friendly answer in 3-4 sentences.
- Use product names (productName field) not material codes
- Include specific numbers and counts
- Explain what this means for the business
- Do NOT mention SQL, tables, or technical terms
- Do NOT list all items if more than 5, summarize instead
- At the end add: ENTITY_IDS: [all material/ID values]`;

    const followUpCompletion = await groq.chat.completions.create({
      model: model,
      messages: [
        { role: 'system', content: 'You are a business data analyst.' },
        { role: 'user', content: followUpMessage }
      ],
      temperature: 0.1,
    });

    const answer = followUpCompletion.choices[0].message.content;

    let nodeIds = extractNodeIds(results, answer);

    const cleanAnswer = answer
      .replace(/ENTITY_IDS:[\s\S]*$/m, '')
      .trim();

    return {
      sql: parsed.sql,
      answer: cleanAnswer,
      results: results,
      nodeIds: nodeIds
    };

  } catch (err) {
    return {
      sql: null,
      answer: "I encountered an error: " + err.message,
      results: [],
      nodeIds: []
    };
  }
}

export async function handleChatStream(userMessage, history, client, onToken, onSql) {
  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const model = 'llama-3.3-70b-versatile';

    let messages = [{ role: 'system', content: SYSTEM_PROMPT }];

    if (history && history.length > 0) {
      let mapped = history.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.text.replace(/\n\[SQL used: .*\]$/, '')
      }));

      while (mapped.length > 0 && mapped[0].role === 'assistant') {
        mapped.shift();
      }

      let validHistory = [];
      let expectedRole = 'user';
      for (const msg of mapped) {
        if (msg.role === expectedRole) {
          validHistory.push(msg);
          expectedRole = expectedRole === 'user' ? 'assistant' : 'user';
        }
      }

      if (validHistory.length > 0 && validHistory[validHistory.length - 1].role === 'user') {
        validHistory.pop();
      }

      messages = messages.concat(validHistory);
    }

    messages.push({ role: 'user', content: userMessage });

    const completion = await groq.chat.completions.create({
      model: model,
      messages: messages,
      temperature: 0.1,
      max_tokens: 1024,
    });

    const responseText = completion.choices[0].message.content;
    const parsed = parseJSON(responseText);

    if (!parsed.sql) {
      if (parsed.answer) {
        onToken(parsed.answer);
      }
      return {
        sql: null,
        answer: parsed.answer,
        results: [],
        nodeIds: []
      };
    }

    const sanitizedSQL = sanitizeSQL(parsed.sql);
    const singleSQL = extractFirstStatement(sanitizedSQL);
    console.log('Executing SQL:', singleSQL);

    if (onSql) onSql(singleSQL);

    const queryResult = await client.query(singleSQL);
    let results = queryResult.rows || [];
    console.log(`Query returned ${results.length} rows`);

    // Fetch product names for any material codes in results
    const materialIds = results
      .map(r => r.material)
      .filter(Boolean);

    if (materialIds.length > 0) {
      const namesResult = await client.query(
        `SELECT pd."product", pd."productDescription" 
         FROM product_descriptions pd 
         WHERE pd."product" = ANY($1) 
         AND pd."language" = 'EN'`,
        [materialIds]
      );
      const nameMap = {};
      namesResult.rows.forEach(r => {
        nameMap[r.product] = r.productDescription;
      });

      // Enrich results with product names
      results = results.map(r => ({
        ...r,
        productName: r.material
          ? (nameMap[r.material] || r.material)
          : undefined
      }));
    }

    const limitedResults = results.slice(0, 50);

    const followUpMessage = `The SQL query returned ${results.length} rows. Here are the results:
${String(JSON.stringify(limitedResults, null, 0))}

Write a clear, business-friendly answer in 3-4 sentences.
- Use product names (productName field) not material codes
- Include specific numbers and counts
- Explain what this means for the business
- Do NOT mention SQL, tables, or technical terms
- Do NOT list all items if more than 5, summarize instead
- At the end add: ENTITY_IDS: [all material/ID values]`;

    const stream = await groq.chat.completions.create({
      model: model,
      messages: [
        { role: 'system', content: 'You are a business data analyst.' },
        { role: 'user', content: followUpMessage }
      ],
      temperature: 0.1,
      max_tokens: 1024,
      stream: true,
    });

    let fullAnswer = '';
    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content || '';
      if (token) {
        fullAnswer += token;
        onToken(token);
      }
    }

    let nodeIds = extractNodeIds(results, fullAnswer);

    const cleanAnswer = fullAnswer
      .replace(/ENTITY_IDS:[\s\S]*$/m, '')
      .trim();

    return {
      sql: parsed.sql,
      answer: cleanAnswer,
      results: results,
      nodeIds: nodeIds
    };

  } catch (err) {
    onToken("I encountered an error: " + err.message);
    return {
      sql: null,
      answer: "I encountered an error: " + err.message,
      results: [],
      nodeIds: []
    };
  }
}
