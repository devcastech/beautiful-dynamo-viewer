import {
  DEFAULT_KEYS,
  SCHEMA_VERSION,
  type Entity,
  type TableSchema,
} from '../domain/schema/types.ts';

const entities: Entity[] = [
  {
    name: 'Product',
    pk: 'PRODUCT#<productId>',
    sk: 'PRODUCT',
    priority: 1,
    indexPatterns: [
      { index: 'GSI1', pk: 'PRODUCTS', sk: 'PRODUCT#<productId>' },
      { index: 'GSI2', pk: 'CATEGORY#<category>', sk: 'SUBCATEGORY#<subcategory>#<productId>' },
      { index: 'GSI3', pk: 'REFERENCE#<reference>', sk: 'PRODUCT#<productId>' },
    ],
    attributes: [
      'id',
      'reference',
      'code',
      'image',
      'description',
      'category',
      'subcategory',
      'packagingUnit',
      'price',
      'minimumQuantity',
      'availableQuantity',
      'status',
      'phase',
      'physicalReference',
      'originalCategory',
      'requiredStock',
      'maximumPrice',
      'priceByPacking',
      'quantityPerTray',
      'createdAt',
      'updatedAt',
      'createdBy',
      'updatedBy',
    ],
    description:
      "Catalog product. Supports two phases: 'presale' (accrues requiredStock) and 'normal' (decrements availableQuantity when an order is created).",
  },
  {
    name: 'User',
    pk: 'USER#<userId>',
    sk: 'USER',
    priority: 1,
    indexPatterns: [
      { index: 'GSI1', pk: 'EMAIL#<email>', sk: 'USER#<userId>' },
      { index: 'GSI2', pk: 'USERS', sk: 'USER#<userId>' },
    ],
    attributes: [
      'id',
      'email',
      'responsible',
      'gallada',
      'phone',
      'whatsapp',
      'storeName',
      'storeAdminName',
      'storeAddress',
      'city',
      'department',
      'deliveryDate',
      'role',
      'status',
      'createdAt',
      'updatedAt',
    ],
    description:
      'System user. Can be an admin, seller or customer. The email is normalized to lowercase in GSI1PK.',
  },
  {
    name: 'OrderMeta',
    pk: 'ORDER#<orderId>',
    sk: 'ORDER',
    priority: 1,
    indexPatterns: [
      { index: 'GSI1', pk: 'USER#<userId>', sk: 'ORDER#<date>#<orderId>' },
      { index: 'GSI2', pk: 'ORDERS', sk: 'STATUS#<status>#<createdAt>#<orderId>' },
    ],
    attributes: [
      'id',
      'orderNumber',
      'userId',
      'sellerId',
      'itemCount',
      'subtotal',
      'maxSubTotal',
      'tax',
      'shipping',
      'total',
      'deliveryContact',
      'deliveryGallada',
      'deliveryPhone',
      'deliveryWhatsapp',
      'deliveryStoreName',
      'deliveryStoreAdminName',
      'deliveryAddress',
      'deliveryCity',
      'deliveryDepartment',
      'deliveryEmail',
      'status',
      'paymentStatus',
      'paymentTerms',
      'notes',
      'orderType',
      'category',
      'expectedDeliveryDate',
      'createdAt',
      'updatedAt',
    ],
    description:
      "Order metadata (without items). GSI1SK encodes the date to allow range queries. GSI2SK includes status+date for status queries with date filtering. Items live in a separate record (ORDER#ITEMS).",
  },
  {
    name: 'OrderItems',
    pk: 'ORDER#<orderId>',
    sk: 'ORDER#ITEMS',
    priority: 2,
    indexPatterns: [],
    attributes: ['items', 'itemCount'],
    description:
      "An order's items array, stored in a record separate from the metadata to avoid exceeding the 400KB limit on the main record. Always fetched together with OrderMeta via a Query BETWEEN 'ORDER' AND 'ORDER#ITEMS'.",
  },
  {
    name: 'Shipment',
    pk: 'ORDER#<orderId>',
    sk: 'SHIPMENT#<dispatchedAt>#<shipmentNumber>',
    priority: 3,
    indexPatterns: [],
    attributes: ['orderId', 'shipmentNumber', 'dispatchedAt', 'dispatchedBy', 'items', 'createdAt'],
    description:
      'Partial dispatch record for an order. The SK includes a timestamp + sequential number for uniqueness and natural ordering. Multiple shipments can exist per order.',
  },
  {
    name: 'OrderHistory',
    pk: 'ORDER#<orderId>',
    sk: 'HISTORY#<changedAt>',
    priority: 4,
    indexPatterns: [],
    attributes: ['orderId', 'changeType', 'changedBy', 'changedAt', 'changes'],
    description:
      'Audit record of changes to an order. changeType can be items_update, status_update, meta_update or cancelled. The changes field is polymorphic depending on the type. Read in descending order (ScanIndexForward: false).',
  },
];

/**
 * Example schema shipped with the app: a single-table e-commerce model with
 * catalog, users and orders. Authored directly in the current (v2) format.
 */
export function seedSchemas(): TableSchema[] {
  return [
    {
      version: SCHEMA_VERSION,
      id: crypto.randomUUID(),
      name: 'ecommerce-demo',
      tableName: 'ecommerce-demo',
      description:
        'Catalog, users and orders all live in one table. The useful read is never a single isolated item but logical shelves that show what falls inside each partition.',
      keys: DEFAULT_KEYS,
      indexes: [
        { name: 'GSI1', pkAttr: 'GSI1PK', skAttr: 'GSI1SK' },
        { name: 'GSI2', pkAttr: 'GSI2PK', skAttr: 'GSI2SK' },
        { name: 'GSI3', pkAttr: 'GSI3PK', skAttr: 'GSI3SK' },
      ],
      entities,
      queries: [],
    },
  ];
}
