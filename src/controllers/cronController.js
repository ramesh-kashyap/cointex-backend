const cron = require('node-cron');
const  spotTradeController  = require('../controllers/spotTradeController');
const  futureTradeController  = require('../controllers/futureTradeController');
// controllers/balanceController.js

const balances = {
    spot: 846.87,
    future: 12543.22
};

const getBalance = (req, res) => {
    const { type } = req.query;

    if (!type) {
        return res.status(400).json({success: false, error: 'Type parameter is required' });
    }

    const balance = balances[type.toLowerCase()];

    if (balance !== undefined) {
        return res.json({ success: true, message: 'Fetch balance successfully', balance });
    } else {
        return res.status(400).json({ error: 'Invalid type. Valid types are \"spot\" or \"future\".' });
    }
};




// Flags to track running status for each cron job
let isFutureCronRunning = false;
let isSpotCronRunning = false;

/**
 * Future Trade Cron Job:
 * Executes every minute to monitor future trade prices.
 */
const futureCronJob = cron.schedule(
  '*/1 * * * *', // Runs every minute; adjust as needed
  async () => {
    try {
      console.log('Running future monitorPrice every minute...');
      await futureTradeController.monitorPrice();
    } catch (error) {
      console.error('Error running future cron job:', error.message);
    }
  },
  {
    scheduled: false, // Do not start automatically
  }
);

/**
 * Spot Trade Cron Job:
 * Executes every minute to monitor spot trade prices.
 */
const spotCronJob = cron.schedule(
  '*/1 * * * *', // Runs every minute; adjust as needed
  async () => {
    try {
      console.log('Running spot monitorPrice every minute...');
      await spotTradeController.monitorPrice();
    } catch (error) {
      console.error('Error running spot cron job:', error.message);
    }
  },
  {
    scheduled: false, // Do not start automatically
  }
);

/**
 * Start Future Cron Job
 */
const startFutureCronJob = (req, res) => {
  if (futureCronJob && !isFutureCronRunning) {
    futureCronJob.start();
    isFutureCronRunning = true;
    console.log('Future Cron job started.');
    return res.json({ status: 'Future Cron job started' });
  } else if (isFutureCronRunning) {
    console.log('Future Cron job is already running');
    return res.json({ status: 'Future Cron job is already running' });
  }
  return res.json({ status: 'Future Cron job is not initialized' });
};

/**
 * Stop Future Cron Job
 */
const stopFutureCronJob = (req, res) => {
  if (futureCronJob && isFutureCronRunning) {
    futureCronJob.stop();
    isFutureCronRunning = false;
    console.log('Future Cron job stopped.');
    return res.json({ status: 'Future Cron job stopped' });
  } else if (!isFutureCronRunning) {
    console.log('Future Cron job is already stopped');
    return res.json({ status: 'Future Cron job is already stopped' });
  }
  return res.json({ status: 'Future Cron job is not initialized' });
};

/**
 * Start Spot Cron Job
 */
const startSpotCronJob = (req, res) => {
  if (spotCronJob && !isSpotCronRunning) {
    spotCronJob.start();
    isSpotCronRunning = true;
    console.log('Spot Cron job started.');
    return res.json({ status: 'Spot Cron job started' });
  } else if (isSpotCronRunning) {
    console.log('Spot Cron job is already running');
    return res.json({ status: 'Spot Cron job is already running' });
  }
  return res.json({ status: 'Spot Cron job is not initialized' });
};

/**
 * Stop Spot Cron Job
 */
const stopSpotCronJob = (req, res) => {
  if (spotCronJob && isSpotCronRunning) {
    spotCronJob.stop();
    isSpotCronRunning = false;
    console.log('Spot Cron job stopped.');
    return res.json({ status: 'Spot Cron job stopped' });
  } else if (!isSpotCronRunning) {
    console.log('Spot Cron job is already stopped');
    return res.json({ status: 'Spot Cron job is already stopped' });
  }
  return res.json({ status: 'Spot Cron job is not initialized' });
};

// Export the start/stop functions to use them in your routes
module.exports = {
  startFutureCronJob,
  stopFutureCronJob,
  startSpotCronJob,
  stopSpotCronJob,
  getBalance 
};
