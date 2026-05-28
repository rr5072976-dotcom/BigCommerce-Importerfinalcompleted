import { Router, type IRouter } from "express";

const router: IRouter = Router();

const CUSTOMER_CSV = `first_name,last_name,email,phone,company
John,Doe,john.doe@example.com,+1-555-010-2026,Test Corp
Jane,Smith,jane.smith@example.com,+1-555-020-3037,Sample Inc
Alex,Johnson,alex.johnson@example.com,+1-555-030-4048,Demo LLC`;

const PRODUCT_CSV = `name,type,sku,price,weight,description,inventory_level,image_url
iPhone 17 Pro Max 256GB Black Titanium,physical,IPH17PROMAX-256-BT,799.99,0.44,"Apple iPhone 17 Pro Max 256GB - Black Titanium. A19 Pro chip, 48MP camera system, 6.9-inch Super Retina XDR ProMotion display.",50,https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-17-pro-finish-select-202509-6-9inch-blacktitanium?wid=800&hei=800&fmt=jpeg&qlt=90
iPhone 17 Pro Max 512GB Desert Titanium,physical,IPH17PROMAX-512-DT,999.99,0.44,"Apple iPhone 17 Pro Max 512GB - Desert Titanium. A19 Pro chip, 48MP camera system, 6.9-inch Super Retina XDR ProMotion display.",30,https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-17-pro-finish-select-202509-6-9inch-deserttitanium?wid=800&hei=800&fmt=jpeg&qlt=90
Blue Cotton T-Shirt,physical,TSHIRT-BLU-M,19.99,0.3,100% cotton t-shirt in blue - Medium,250,https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800`;

const ORDER_CSV = `email,first_name,last_name,product_sku,quantity,currency_code,street_1,city,state,zip,country,country_iso2,tracking_number,tracking_carrier,tracking_comments
john.doe@example.com,John,Doe,TEST-001,1,USD,123 Test Street,New York,New York,10001,United States,US,1Z999AA10123456784,ups,Your order has been shipped!
jane.smith@example.com,Jane,Smith,TSHIRT-BLU-M,2,USD,456 Main St,Los Angeles,California,90001,United States,US,9400111899223397860538,usps,
alex.johnson@example.com,Alex,Johnson,MOUSE-WL-001,1,USD,789 Oak Ave,Chicago,Illinois,60601,United States,US,,,`;

router.get("/templates/customers", (_req, res): void => {
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=customers_template.csv");
  res.send(CUSTOMER_CSV);
});

router.get("/templates/products", (_req, res): void => {
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=products_template.csv");
  res.send(PRODUCT_CSV);
});

router.get("/templates/orders", (_req, res): void => {
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=orders_template.csv");
  res.send(ORDER_CSV);
});

export default router;
