import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Users, Box, ShoppingCart } from "lucide-react";

interface FieldDef {
  name: string;
  required: boolean;
  description: string;
}

interface TemplateCard {
  type: "customers" | "products" | "orders";
  label: string;
  icon: React.ElementType;
  description: string;
  fields: FieldDef[];
  exampleRow: string;
}

const TEMPLATES: TemplateCard[] = [
  {
    type: "customers",
    label: "Customers",
    icon: Users,
    description: "Create customer accounts in your BigCommerce store",
    exampleRow: "John,Doe,john@example.com,9999999999,ABC Ltd",
    fields: [
      { name: "first_name", required: true, description: "Customer's first name" },
      { name: "last_name", required: true, description: "Customer's last name" },
      { name: "email", required: true, description: "Unique email address" },
      { name: "phone", required: false, description: "Phone number" },
      { name: "company", required: false, description: "Company or organization name" },
    ],
  },
  {
    type: "products",
    label: "Products",
    icon: Box,
    description: "Add products to your BigCommerce catalog",
    exampleRow: "iPhone 17 Pro Max 256GB,physical,IPH17PROMAX-256-BT,799.99,0.44,Apple iPhone 17 Pro Max...,50,https://...",
    fields: [
      { name: "name", required: true, description: "Product name" },
      { name: "type", required: false, description: "Product type (default: physical)" },
      { name: "sku", required: true, description: "Unique SKU identifier" },
      { name: "price", required: true, description: "Product price (numeric)" },
      { name: "weight", required: true, description: "Weight in lbs (numeric)" },
      { name: "description", required: false, description: "Product description text" },
      { name: "inventory_level", required: false, description: "Initial inventory count" },
      { name: "image_url", required: false, description: "Public URL of the product image (jpg/png)" },
    ],
  },
  {
    type: "orders",
    label: "Orders",
    icon: ShoppingCart,
    description: "Create orders — customers and products are auto-matched by email/SKU",
    exampleRow: "john@example.com,TSHIRT001,2,John,Doe,Street 1,New York,United States,NY,10001",
    fields: [
      { name: "email", required: true, description: "Customer email (finds or creates customer)" },
      { name: "product_sku", required: true, description: "Product SKU to order" },
      { name: "quantity", required: true, description: "Quantity to order" },
      { name: "first_name", required: true, description: "Billing/shipping first name" },
      { name: "last_name", required: true, description: "Billing/shipping last name" },
      { name: "street", required: true, description: "Street address" },
      { name: "city", required: true, description: "City" },
      { name: "country", required: true, description: "Country (full name, e.g. United States)" },
      { name: "state", required: true, description: "State or province" },
      { name: "zip", required: true, description: "Postal/ZIP code" },
    ],
  },
];

export default function Templates() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">CSV Templates</h2>
        <p className="text-muted-foreground mt-1">Download templates and review required field formats before importing</p>
      </div>

      <div className="space-y-6">
        {TEMPLATES.map((t) => (
          <Card key={t.type}>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <t.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{t.label} CSV</CardTitle>
                    <CardDescription className="mt-0.5">{t.description}</CardDescription>
                  </div>
                </div>
                <a href={`/api/templates/${t.type}`} download>
                  <Button data-testid={`button-download-${t.type}`} variant="outline" size="sm" className="gap-2">
                    <Download className="w-4 h-4" />
                    Download Template
                  </Button>
                </a>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Fields table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground border-b border-border">
                      <th className="text-left pb-2 font-medium">Column Name</th>
                      <th className="text-left pb-2 font-medium">Required</th>
                      <th className="text-left pb-2 font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {t.fields.map((f) => (
                      <tr key={f.name} className="border-b border-border/50 last:border-0">
                        <td className="py-2 font-mono text-xs text-primary">{f.name}</td>
                        <td className="py-2">
                          {f.required ? (
                            <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-xs px-1.5 py-0">required</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs px-1.5 py-0">optional</Badge>
                          )}
                        </td>
                        <td className="py-2 text-muted-foreground">{f.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Example row */}
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Example row:</p>
                <div className="bg-muted/50 border border-border rounded px-3 py-2 font-mono text-xs text-muted-foreground overflow-auto">
                  <span className="text-primary/60">{t.fields.map((f) => f.name).join(",")}</span>
                  <br />
                  {t.exampleRow}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
