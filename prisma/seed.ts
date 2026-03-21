import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.provider.deleteMany();
  await prisma.tip.deleteMany();

  await prisma.provider.createMany({
    data: [
      {
        name: "Sunrise Family Medical Group",
        address: "4521 W Olympic Blvd",
        city: "Los Angeles",
        state: "CA",
        zip: "90019",
        programs: ["Medicaid Primary Care"],
        totalPaid: 287_000,
        riskScore: 22,
        anomalies: [],
        licenseDate: new Date("2015-03-12"),
        ownerId: "owner-001",
      },
      {
        name: "Greenfield Pediatrics",
        address: "812 Elm St",
        city: "Houston",
        state: "TX",
        zip: "77002",
        programs: ["Medicaid Pediatrics", "CHIP"],
        totalPaid: 412_000,
        riskScore: 31,
        anomalies: [],
        licenseDate: new Date("2012-08-20"),
        ownerId: "owner-002",
      },
      {
        name: "Pacific Home Health Services LLC",
        address: "1933 S Vermont Ave",
        city: "Los Angeles",
        state: "CA",
        zip: "90007",
        programs: ["Medicaid Home Health"],
        totalPaid: 1_847_000,
        riskScore: 82,
        anomalies: [
          "Billing 847% above median for zip 90007",
          "License issued 90 days before first claim",
          "All patients listed at 2 residential addresses",
        ],
        licenseDate: new Date("2023-06-15"),
        ownerId: "owner-003",
      },
      {
        name: "Bright Futures Daycare Center",
        address: "2200 Martin Luther King Jr Blvd",
        city: "Oakland",
        state: "CA",
        zip: "94612",
        programs: ["CA Daycare Subsidy"],
        totalPaid: 923_000,
        riskScore: 78,
        anomalies: [
          "Capacity listed as 15 children but billing for 47",
          "Owner also owns 3 other flagged daycares in Alameda County",
        ],
        licenseDate: new Date("2021-11-03"),
        ownerId: "owner-004",
      },
      {
        name: "Eternal Rest Hospice Care Inc",
        address: "6810 Crenshaw Blvd",
        city: "Los Angeles",
        state: "CA",
        zip: "90043",
        programs: ["Medicare Hospice"],
        totalPaid: 4_231_000,
        riskScore: 97,
        anomalies: [
          "Billing 1,047% above median for zip 90043",
          "92% of patients discharged alive (national avg: 49%)",
          "Average length of stay 340 days (national avg: 92 days)",
          "Owner linked to 2 excluded providers",
          "Business registered 45 days before first Medicare claim",
        ],
        licenseDate: new Date("2024-01-08"),
        ownerId: "owner-005",
      },
    ],
  });

  console.log("Seeded 5 providers");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
