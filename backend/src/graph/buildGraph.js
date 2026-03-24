export async function getGraph(client) {
  // NODES
  const salesOrdersRes = await client.query(`
    SELECT "salesOrder" as id, "soldToParty", "totalNetAmount", 
           "overallDeliveryStatus", "overallOrdReltdBillgStatus", 
           "transactionCurrency", "creationDate" 
    FROM sales_order_headers 
    LIMIT 150
  `);

  const businessPartnersRes = await client.query(`
    SELECT "businessPartner" as id, "businessPartnerName", 
           "industry", "customer" 
    FROM business_partners 
    LIMIT 150
  `);

  const outboundDeliveriesRes = await client.query(`
    SELECT "deliveryDocument" as id, "actualGoodsMovementDate", 
           "overallGoodsMovementStatus", "shippingPoint" 
    FROM outbound_delivery_headers 
    LIMIT 150
  `);

  const billingDocumentsRes = await client.query(`
    SELECT "billingDocument" as id, "totalNetAmount", 
           "billingDocumentIsCancelled", "transactionCurrency", 
           "soldToParty", "billingDocumentDate" 
    FROM billing_document_headers 
    LIMIT 150
  `);

  const journalEntriesRes = await client.query(`
    SELECT DISTINCT "accountingDocument" as id, "postingDate", 
           "amountInTransactionCurrency", "transactionCurrency", 
           "referenceDocument" 
    FROM journal_entry_items 
    LIMIT 150
  `);

  const paymentsRes = await client.query(`
    SELECT "accountingDocument" || '_PAY' as id, 
           "accountingDocument", "amountInTransactionCurrency", 
           "clearingDate", "invoiceReference", "salesDocument", 
           "transactionCurrency" 
    FROM payments 
    LIMIT 150
  `);

  const productsRes = await client.query(`
    SELECT p."product" as id, pd."productDescription", 
           p."productGroup", p."division" 
    FROM products p 
    LEFT JOIN product_descriptions pd 
    ON p."product" = pd."product" AND pd."language" = 'EN' 
    LIMIT 150
  `);

  const plantsRes = await client.query(`
    SELECT "plant" as id, "plantName" 
    FROM plants 
    LIMIT 50
  `);

  const nodes = [];

  const addNodes = (rows, nodeType) => {
    rows.forEach(row => {
      let label = row.id;
      if (nodeType === 'BusinessPartner' && row.businessPartnerName) {
        label = row.businessPartnerName;
      } else if (nodeType === 'Product') {
        label = row.productDescription || row.id;
      }

      nodes.push({
        id: row.id,
        type: "custom",
        position: { x: 0, y: 0 },
        data: {
          nodeType: nodeType,
          label: label,
          meta: { ...row }
        }
      });
    });
  };

  addNodes(salesOrdersRes.rows, 'SalesOrder');
  addNodes(businessPartnersRes.rows, 'BusinessPartner');
  addNodes(outboundDeliveriesRes.rows, 'OutboundDelivery');
  addNodes(billingDocumentsRes.rows, 'BillingDocument');
  addNodes(journalEntriesRes.rows, 'JournalEntry');
  addNodes(paymentsRes.rows, 'Payment');
  addNodes(productsRes.rows, 'Product');
  addNodes(plantsRes.rows, 'Plant');

  // EDGES
  const soldToRes = await client.query(`
    SELECT "soldToParty" as source, "salesOrder" as target, 
           'SOLD_TO' as label 
    FROM sales_order_headers 
    WHERE "soldToParty" IS NOT NULL 
    LIMIT 300
  `);

  const deliveredByRes = await client.query(`
    SELECT DISTINCT "referenceSdDocument" as source, 
           "deliveryDocument" as target, 'DELIVERED_BY' as label 
    FROM outbound_delivery_items 
    WHERE "referenceSdDocument" IS NOT NULL 
    LIMIT 300
  `);

  const billedAsRes = await client.query(`
    SELECT DISTINCT "referenceSdDocument" as source, 
           "billingDocument" as target, 'BILLED_AS' as label 
    FROM billing_document_items 
    WHERE "referenceSdDocument" IS NOT NULL 
    LIMIT 300
  `);

  const postedToRes = await client.query(`
    SELECT "billingDocument" as source, 
           "accountingDocument" as target, 'POSTED_TO' as label 
    FROM billing_document_headers 
    WHERE "accountingDocument" IS NOT NULL 
    LIMIT 300
  `);

  const clearedByRes = await client.query(`
    SELECT "invoiceReference" as source, 
           "accountingDocument" || '_PAY' as target, 
           'CLEARED_BY' as label 
    FROM payments 
    WHERE "invoiceReference" IS NOT NULL 
    LIMIT 300
  `);

  const containsRes = await client.query(`
    SELECT DISTINCT "salesOrder" as source, 
           "material" as target, 'CONTAINS' as label 
    FROM sales_order_items 
    WHERE "material" IS NOT NULL 
    LIMIT 300
  `);

  const shippedFromRes = await client.query(`
    SELECT DISTINCT "deliveryDocument" as source, 
           "plant" as target, 'SHIPPED_FROM' as label 
    FROM outbound_delivery_items 
    WHERE "plant" IS NOT NULL 
    LIMIT 300
  `);

  const allEdges = [
    ...soldToRes.rows,
    ...deliveredByRes.rows,
    ...billedAsRes.rows,
    ...postedToRes.rows,
    ...clearedByRes.rows,
    ...containsRes.rows,
    ...shippedFromRes.rows
  ];

  // Map nodes array to a Set for quick ID lookup
  const nodeIdsSet = new Set(nodes.map(n => n.id));

  // Filter edges
  const edges = [];
  allEdges.forEach(row => {
    if (nodeIdsSet.has(row.source) && nodeIdsSet.has(row.target)) {
      edges.push({
        id: `${row.source}-${row.target}-${row.label}`,
        source: row.source,
        target: row.target,
        label: row.label,
        animated: false
      });
    }
  });

  return { nodes, edges };
}
