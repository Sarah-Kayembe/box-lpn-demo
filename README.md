# BoxTag

**Pack now, ship later. One barcode for the box and everything inside it.**

BoxTag is a proof of concept built on the ScanPower v3 API. A worker packs a box, prints a 4 × 6 label with one barcode, and puts the box on a shelf. Later, anyone can scan the label to see exactly what's inside and where it is, then add the whole box to an Amazon shipment without unpacking or rescanning a single item.

![Overview](docs/overview.png)

## Why

ScanPower boxes (`/v3/az-box`) always belong to a shipment, and the box label endpoint (`/v3/label/box`) prints Amazon shipment labels. There's no way to pack a box before a shipment exists, store it, and keep track of what's in it. Warehouses usually solve this with a license plate number (LPN), a unique barcode for a box and its contents. BoxTag adds that step.

## How it works

1. **Pack.** Scan an FNSKU or search by SKU or product name. Each scan adds one unit. Items that need an expiration date can't be sealed without one, and lot codes are optional. Box size comes from a pack template or can be typed in.
2. **Label.** Sealing the box gives it an ID like `BT-000104` and opens a 4 × 6 label for Rollo, Zebra and similar printers. The **Code 128** barcode holds the box ID for warehouse scanners. The **QR code** opens the box in BoxTag on a phone. The label also lists the SKUs, quantities and expiration dates, so it's readable without any device.
3. **Store.** Put the box away at a ScanPower location (`/v3/location`). Moves are recorded in the box history.
4. **Scan.** A scanner, a phone camera (Chrome on Android and desktop), or a typed ID opens the box with its live contents and location. Partial input like `104` works too.
5. **Ship.** Pick an open shipment and the box goes in with all its items. The screen can show the exact ScanPower API calls this makes.

| Pack | Box page and API preview | Printed label |
|---|---|---|
| ![Pack](docs/pack.png) | ![Box](docs/box.png) | ![Label](docs/label.png) |

## Mock mode and live mode

Everything goes through one client (`src/lib/api/client.ts`) with two sources.

- **Mock (default)** uses sample data shaped exactly like ScanPower v3 responses (`src/lib/mock-data.ts`). No account needed.
- **Live** calls ScanPower through `src/app/api/scanpower/[...path]/route.ts`, a small server-side proxy that logs in with `GET /v3/auth` (Basic auth), caches the bearer token, and only forwards the few paths BoxTag needs. Credentials never reach the browser.

| BoxTag action | ScanPower endpoint |
|---|---|
| Search inventory while packing | `GET /v3/inventory` |
| Choose a box size | `GET /v3/pack-template` |
| Put away or move a box | `GET /v3/location` |
| List open shipments | `GET /v3/az-shipment` |
| Add a box to a shipment | `POST /v3/az-box`, then `PATCH /v3/az-box/items` |

**Status.** Mock mode is fully tested in the browser, including a pack to label to store to scan to ship walkthrough, phone-sized screens, and printing. The printed barcodes were checked with a barcode decoder. Live mode is written from the OpenAPI document and has **not yet been run against a real ScanPower account**.

### Where box records live

ScanPower doesn't have a place for a box that isn't in a shipment yet, so this demo keeps BoxTag records in the browser (`src/lib/api/box-tag-store.ts`). In the real product they'd belong in ScanPower, for example:

```
GET    /v3/box-tag?status=stored&location_id=...
POST   /v3/box-tag                 { items, dimensions, weight, notes }
PATCH  /v3/box-tag/{box_tag_id}    { location_id }
POST   /v3/box-tag/{box_tag_id}/ship  { shipment_id }   -> creates the az-box and items
GET    /v3/label/box-tag?box_tag_ids=...   -> 4 x 6 PDF
```

The screens only talk to `api.*`, so swapping the browser store for these endpoints wouldn't change any UI code.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000. Use **Reset demo data** on the overview page to start over.

For live mode, copy `.env.example` to `.env.local` and fill in:

```
NEXT_PUBLIC_BOXTAG_MODE=live
SCANPOWER_BASE_URL=https://beta.scanpower.com/api
SCANPOWER_USERNAME=...
SCANPOWER_PASSWORD=...
NEXT_PUBLIC_SCANPOWER_SHIP_FROM_ID=...
```

## Built with

Next.js 15, TypeScript, Tailwind CSS 4, and [bwip-js](https://github.com/metafloor/bwip-js) for the barcodes.

---

A proof of concept by Sarah Kayembe. Not an official ScanPower product. All product names and data in mock mode are made up.
