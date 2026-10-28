const express = require("express");
const cors = require("cors");
const escpos = require("escpos");

escpos.Network = require("escpos-network");

const app = express();
app.use(cors());
app.use(express.json());

const PRINTER_IP = "192.168.1.87";
const PRINTER_PORT = 9100;

app.post("/print/kot", (req, res) => {
  try {
    const { order } = req.body;

    if (!order || !order.items) {
      return res.status(400).json({ error: "Invalid order data" });
    }

    const device = new escpos.Network(PRINTER_IP, PRINTER_PORT);
    const printer = new escpos.Printer(device);
    const message = "hello";

    device.open(() => {
      printer
        .align("CT")
        .style("B")
        .size(0, 0)
        .text("KITCHEN ORDER")
        .text("------------------------------------------")
        .align("LT")
        .style("NORMAL")
        .text(`Order: ${order.id}`)
        .text(`Time: ${order.date} ${order.time}`)
        .text("------------------------------------------");

      order.items.forEach(item => {
        printer.text(item.dishName);
        printer.text(`Variant: ${item.selectedSize} - ${item.spiciness}`)
        printer.text(`Spec: ${item.notes}`)
        printer.text(`Qty: ${item.quantity}`);
        printer.text("------------------------------------------");
      });

      printer
        .cut()
        .close();
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Print failed:", err);
    res.status(500).json({ error: "Print failed" });
  }
});

// test   --------------------------------------------------------------------------------------------

app.get("/test-print", (req, res) => {
  const device = new escpos.Network(PRINTER_IP, PRINTER_PORT);
  const printer = new escpos.Printer(device);

  device.open(() => {
    printer
      .align("CT")
      .text("TEST KOT")
      .text("Printer Connected OK")
      .cut()
      .close();
  });

  res.send("Test print sent");
});

// test   --------------------------------------------------------------------------------------------

app.get("/printer/status", (req, res) => {
  const device = new escpos.Network(PRINTER_IP, PRINTER_PORT, { timeout: 3000 });

  device.open(err => {
    if (err) {
      console.error("Printer not reachable:", err.message);
      return res.status(503).json({
        connected: false,
        message: "Printer not connected"
      });
    }

    device.close();
    res.json({
      connected: true,
      message: "Printer connected"
    });
  });
});

app.listen(9001, () => {
  console.log("KOT Printer Service running on port 9001");
});