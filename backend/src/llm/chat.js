import { GoogleGenerativeAI } from '@google/generative-ai';

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
4. All column names are camelCase and case-sensitive. Always quote them: "columnName"
5. Always add LIMIT 100 unless the query is a COUNT or aggregation.
6. For broken flow detection:
   - Delivered not billed: overallDeliveryStatus='C' AND overallOrdReltdBillgStatus != 'C'
   - Billed not delivered: overallOrdReltdBillgStatus='C' AND overallDeliveryStatus != 'C'
`;

function extractNodeIds(results) {
  const nodeIdsSet = new Set();
  const fieldsToScan = [
    'salesOrder', 'billingDocument', 'deliveryDocument',
    'accountingDocument', 'businessPartner', 'product', 'plant'
  ];

  results.forEach(row => {
    fieldsToScan.forEach(field => {
      if (row[field] !== undefined && row[field] !== null) {
        nodeIdsSet.add(row[field]);
      }
    });
  });

  return Array.from(nodeIdsSet);
}

export async function handleChat(userMessage, history, client) {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    const formattedHistory = (history || []).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }]
    }));

    const chat = model.startChat({
      history: formattedHistory
    });

    const result = await chat.sendMessage(userMessage);
    const responseText = result.response.text();
    const cleanText = responseText.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleanText);

    if (!parsed.sql) {
      return {
        sql: null,
        answer: parsed.answer,
        results: [],
        nodeIds: []
      };
    }

    const sqlRes = await client.query(parsed.sql);
    let fullResults = sqlRes.rows;
    let nodeIds = extractNodeIds(fullResults);

    const limitedResults = fullResults.slice(0, 50);

    const followUpMessage = `The SQL query returned ${fullResults.length} rows. Here are the results:
${String(JSON.stringify(limitedResults))}
Based on these actual results, write a clear 2-3 sentence business-friendly answer. Be specific with numbers and names. Respond directly with the text of your answer, do not use JSON.`;

    // Follow-up chat model without strict json
    const followUpModel = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
    });
    const followUpRes = await followUpModel.generateContent(followUpMessage);
    const answer = followUpRes.response.text();

    return {
      sql: parsed.sql,
      answer: answer,
      results: fullResults,
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
