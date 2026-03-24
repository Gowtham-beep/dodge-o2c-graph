CREATE TABLE IF NOT EXISTS business_partners (
  "businessPartner" TEXT PRIMARY KEY,
  "customer" TEXT,
  "businessPartnerFullName" TEXT,
  "businessPartnerName" TEXT,
  "industry" TEXT,
  "businessPartnerIsBlocked" TEXT,
  "isMarkedForArchiving" TEXT,
  "creationDate" TEXT
);

CREATE TABLE IF NOT EXISTS business_partner_addresses (
  "businessPartner" TEXT,
  "addressId" TEXT,
  "cityName" TEXT,
  "country" TEXT,
  "postalCode" TEXT,
  "region" TEXT,
  "streetName" TEXT,
  PRIMARY KEY ("businessPartner", "addressId")
);

CREATE TABLE IF NOT EXISTS customer_company_assignments (
  "customer" TEXT,
  "companyCode" TEXT,
  "paymentTerms" TEXT,
  "reconciliationAccount" TEXT,
  "deletionIndicator" TEXT,
  PRIMARY KEY ("customer", "companyCode")
);

CREATE TABLE IF NOT EXISTS customer_sales_area_assignments (
  "customer" TEXT,
  "salesOrganization" TEXT,
  "distributionChannel" TEXT,
  "division" TEXT,
  "currency" TEXT,
  "customerPaymentTerms" TEXT,
  PRIMARY KEY ("customer", "salesOrganization", "distributionChannel", "division")
);

CREATE TABLE IF NOT EXISTS plants (
  "plant" TEXT PRIMARY KEY,
  "plantName" TEXT,
  "salesOrganization" TEXT,
  "addressId" TEXT,
  "plantCategory" TEXT
);

CREATE TABLE IF NOT EXISTS products (
  "product" TEXT PRIMARY KEY,
  "productType" TEXT,
  "grossWeight" NUMERIC,
  "netWeight" NUMERIC,
  "weightUnit" TEXT,
  "productGroup" TEXT,
  "baseUnit" TEXT,
  "division" TEXT,
  "isMarkedForDeletion" TEXT
);

CREATE TABLE IF NOT EXISTS product_descriptions (
  "product" TEXT,
  "language" TEXT,
  "productDescription" TEXT,
  PRIMARY KEY ("product", "language")
);

CREATE TABLE IF NOT EXISTS product_plants (
  "product" TEXT,
  "plant" TEXT,
  "profitCenter" TEXT,
  PRIMARY KEY ("product", "plant")
);

CREATE TABLE IF NOT EXISTS product_storage_locations (
  "product" TEXT,
  "plant" TEXT,
  "storageLocation" TEXT,
  PRIMARY KEY ("product", "plant", "storageLocation")
);

CREATE TABLE IF NOT EXISTS sales_order_headers (
  "salesOrder" TEXT PRIMARY KEY,
  "salesOrderType" TEXT,
  "salesOrganization" TEXT,
  "soldToParty" TEXT,
  "creationDate" TEXT,
  "totalNetAmount" NUMERIC,
  "overallDeliveryStatus" TEXT,
  "overallOrdReltdBillgStatus" TEXT,
  "overallSdDocReferenceStatus" TEXT,
  "transactionCurrency" TEXT,
  "requestedDeliveryDate" TEXT,
  "headerBillingBlockReason" TEXT,
  "deliveryBlockReason" TEXT
);

CREATE TABLE IF NOT EXISTS sales_order_items (
  "salesOrder" TEXT,
  "salesOrderItem" TEXT,
  "material" TEXT,
  "requestedQuantity" NUMERIC,
  "requestedQuantityUnit" TEXT,
  "netAmount" NUMERIC,
  "productionPlant" TEXT,
  "storageLocation" TEXT,
  "salesDocumentRjcnReason" TEXT,
  PRIMARY KEY ("salesOrder", "salesOrderItem")
);

CREATE TABLE IF NOT EXISTS sales_order_schedule_lines (
  "salesOrder" TEXT,
  "salesOrderItem" TEXT,
  "scheduleLine" TEXT,
  "confirmedDeliveryDate" TEXT,
  "confdOrderQtyByMatlAvailCheck" NUMERIC,
  PRIMARY KEY ("salesOrder", "salesOrderItem", "scheduleLine")
);

CREATE TABLE IF NOT EXISTS outbound_delivery_headers (
  "deliveryDocument" TEXT PRIMARY KEY,
  "actualGoodsMovementDate" TEXT,
  "creationDate" TEXT,
  "overallGoodsMovementStatus" TEXT,
  "overallPickingStatus" TEXT,
  "shippingPoint" TEXT,
  "deliveryBlockReason" TEXT
);

CREATE TABLE IF NOT EXISTS outbound_delivery_items (
  "deliveryDocument" TEXT,
  "deliveryDocumentItem" TEXT,
  "referenceSdDocument" TEXT,
  "referenceSdDocumentItem" TEXT,
  "actualDeliveryQuantity" NUMERIC,
  "plant" TEXT,
  "storageLocation" TEXT,
  PRIMARY KEY ("deliveryDocument", "deliveryDocumentItem")
);

CREATE TABLE IF NOT EXISTS billing_document_headers (
  "billingDocument" TEXT PRIMARY KEY,
  "billingDocumentType" TEXT,
  "creationDate" TEXT,
  "billingDocumentDate" TEXT,
  "billingDocumentIsCancelled" TEXT,
  "cancelledBillingDocument" TEXT,
  "totalNetAmount" NUMERIC,
  "transactionCurrency" TEXT,
  "companyCode" TEXT,
  "fiscalYear" TEXT,
  "accountingDocument" TEXT,
  "soldToParty" TEXT
);

CREATE TABLE IF NOT EXISTS billing_document_items (
  "billingDocument" TEXT,
  "billingDocumentItem" TEXT,
  "material" TEXT,
  "billingQuantity" NUMERIC,
  "billingQuantityUnit" TEXT,
  "netAmount" NUMERIC,
  "referenceSdDocument" TEXT,
  "referenceSdDocumentItem" TEXT,
  PRIMARY KEY ("billingDocument", "billingDocumentItem")
);

CREATE TABLE IF NOT EXISTS billing_document_cancellations (
  "billingDocument" TEXT PRIMARY KEY,
  "billingDocumentType" TEXT,
  "cancelledBillingDocument" TEXT,
  "totalNetAmount" NUMERIC,
  "companyCode" TEXT,
  "fiscalYear" TEXT,
  "accountingDocument" TEXT,
  "soldToParty" TEXT
);

CREATE TABLE IF NOT EXISTS journal_entry_items (
  "companyCode" TEXT,
  "fiscalYear" TEXT,
  "accountingDocument" TEXT,
  "accountingDocumentItem" TEXT,
  "glAccount" TEXT,
  "referenceDocument" TEXT,
  "customer" TEXT,
  "amountInTransactionCurrency" NUMERIC,
  "transactionCurrency" TEXT,
  "postingDate" TEXT,
  "clearingDate" TEXT,
  "clearingAccountingDocument" TEXT,
  PRIMARY KEY ("accountingDocument", "accountingDocumentItem", "fiscalYear")
);

CREATE TABLE IF NOT EXISTS payments (
  "accountingDocument" TEXT,
  "accountingDocumentItem" TEXT,
  "fiscalYear" TEXT,
  "customer" TEXT,
  "invoiceReference" TEXT,
  "salesDocument" TEXT,
  "amountInTransactionCurrency" NUMERIC,
  "transactionCurrency" TEXT,
  "clearingDate" TEXT,
  "postingDate" TEXT,
  PRIMARY KEY ("accountingDocument", "accountingDocumentItem", "fiscalYear")
);
