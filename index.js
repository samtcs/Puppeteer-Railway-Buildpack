const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
app.use(express.json());

app.post('/api/lookup', async (req, res) => {
  const { rego, state } = req.body;

  if (!rego || state !== 'QLD') {
    return res.status(400).json({ success: false, message: 'Invalid input' });
  }

  try {
    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // Go to the QLD rego check page
    await page.goto('https://www.service.transport.qld.gov.au/VehicleRegistrationCheck/', {
      waitUntil: 'networkidle2'
    });

    // Fill in the rego
    await page.type('#vehicleRego', rego);

    // Submit the form
    await Promise.all([
      page.click('#searchButton'),
      page.waitForNavigation({ waitUntil: 'networkidle0' })
    ]);

    // Try to extract vehicle details from the result
    const data = await page.evaluate(() => {
      const getText = (sel) => document.querySelector(sel)?.textContent?.trim();
      return {
        make: getText('#make') || null,
        model: getText('#model') || null,
        year: getText('#year') || null
      };
    });

    await browser.close();

    if (!data.make) {
      return res.status(404).json({ success: false, message: 'Vehicle not found or unsupported format' });
    }

    res.json({
      success: true,
      rego,
      state,
      ...data
    });

  } catch (error) {
    console.error('Scraper error:', error.message);
    res.status(500).json({ success: false, message: 'Internal scraper error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
