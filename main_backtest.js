/*
 * Signal Backtesting Server. Simulates a broker using historical data.
 * 
 * The server gets historical data from the "output.csv" file then formats the data to be used in the server.
 * A client can connect to the server by first creating a portfolio by sending a request to the correct "/portfolio" API endpoint.
 * After the creation of the portfolio the client can get price data or execute orders. The exchange data changes specifically for every client
 * which allows for easier analysis of the data on the client side.
 * 
 * By Anas Arkawi, 2022
 * 
 */
// TODO: Add server-side logging functionality



// Import modules
const express = require('express');
const fs = require('fs');
const { exit } = require('process');
const { v4: uuidv4 } = require('uuid');



// Import configuration
// TODO: Implment exchange configuration
let logFolder = './logs';



// Data logging configuration
function dateStr() {
    let currentDate = new Date();
    let date = '';
    if (currentDate.getDay().toString().length == 1) {
        date += `0${currentDate.getDay().toString()}`;
    } else {
        date += `${currentDate.getDay().toString()}`;
    }
    if (currentDate.getMonth().toString().length == 1) {
        date += `0${currentDate.getMonth().toString()}`;
    } else {
        date += `${currentDate.getMonth().toString()}`;
    }
    date += `${currentDate.getFullYear().toString()}T`;

    if (currentDate.getHours().toString().length == 1) {
        date += `0${currentDate.getHours().toString()}`;
    } else {
        date += `${currentDate.getHours().toString()}`;
    }
    if (currentDate.getMinutes().toString().length == 1) {
        date += `0${currentDate.getMinutes().toString()}`;
    } else {
        date += `${currentDate.getMinutes().toString()}`;
    }
    if (currentDate.getSeconds().toString().length == 1) {
        date += `0${currentDate.getSeconds().toString()}`;
    } else {
        date += `${currentDate.getSeconds().toString()}`;
    }
    return date;
}
let portfolioDataFilename = 'test.json' //`./portfolioLog_${dateStr()}.json`;
if (!fs.existsSync(portfolioDataFilename)) {
    fs.writeFileSync(portfolioDataFilename, JSON.stringify({}));
}

// Configure express

// Initialize express app
const app = express();

// Configure the app to recieve/send JSON as body
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Initialize routers

// Data endpoints
const routerDataStream = express.Router(); // Router for data stream endpoints
app.use('/data', routerDataStream); // Assign the router to `data/` endpoint

// Order endpoints
const routerMarketOrders = express.Router(); // Router for market orders
app.use('/order', routerMarketOrders); // Assign the router to `order/` endpoint

// Portfolio endpoints
const routerPortfolio = express.Router();
app.use('/portfolio', routerPortfolio);

// Supervisor endpoints
const routerSupervisor = express.Router();
app.use('/supervisor', routerSupervisor);



// Configure exchange routines


// Market Data

// Retrieve raw data
// Gets raw data from `output.csv` file into an array
// The input file will have the headers ['time', 'currentPrice']
// The time is in milliseconds since UNIX Epoch
let lines = fs.readFileSync('./output.csv', 'utf8');
lines = lines.split('\r\n');
let prices = []; // Raw price data
let priceDict = {}; // Used for on request update
for(let i = 0; i < lines.length; i++) {
    price = lines[i].split(',');
    price = [parseInt(price[0]), parseFloat(price[1])]
    prices.push(price);
    priceDict[price[0]] = parseFloat(price[1]);
}
// The current market data for live trading
let marketData = {
    timeIntervalAbsolute: prices[1][0] - prices[0][0], // Time between prices
    timeInterval: 75, // Time interval (in milliseconds) for simulation
    currentTime: prices[0][0], // Time for the current price
    currentPrice: prices[0][1] // The current closing price
};
// Update the current prices at given intervals
// TODO: For live trading, not implemented
let livePrices = prices; // Price data used for live trading
function setMarket() {
    livePrices.shift();
    if (livePrices.length == 0) {
        console.log('Price data finished, terminating script.');
        // process.exit();
        return false;
    }
    marketData.currentTime = livePrices[0][0];
    marketData.currentPrice = livePrices[0][1];
    // console.log(`Price Time: ${(new Date(marketData.currentTime).toISOString())} \nCurrent Price: ${marketData.currentPrice}\n`);
}
// TODO: Rewrite output function
// const marketRefreshInterval = setInterval(setMarket, marketData.timeInterval); // For live trading, not implemented
if (livePrices.length == 0) {
    clearInterval(marketRefreshInterval);
}


// Exchange outines


// Portfolio routines
// TODO: Add different trading pairs
// TODO: Save portfolio data during runtime

// Entity specific portfolios
// TODO: Improve portfolio storing
let portfolioStore = {}
function Portfolio(btcTotal, eurTotal, path) {
    this.portfolio = {};
    this.portfolio.btcTotal = btcTotal;
    this.portfolio.eurTotal = eurTotal;
    this.portfolio.value = 0; // Updated during runtime
    this.portfolio.currentTime = 0; // Current market time for the entity
    this.portfolio.path = path;
    return this.portfolio;
}
/* Example portfolio store
    portfolioStore = {
        "70e0d6e6-5dd1-452e-805c-fbb041bb0e25": {
            btcTotal: 0.0, // Amount of BTC held
            eurTotal: 0.0, // Amount of EUR held
            value: 0.0, // Value of the portfolio
            currentTime: 0 // Current market time for the entity
        },
        "2fbed52f-8d4f-4a94-971a-908b0e521630": {
            btcTotal: 0.0, // Amount of BTC held
            eurTotal: 0.0, // Amount of EUR held
            value: 0.0, // Value of the portfolio
            currentTime: 0 // Current market time for the entity
        }
    }
*/
// Create portfolio
function portfolioCreate(btcTotal, eurTotal) {
    let portfolioId = uuidv4();
    let path = `${logFolder}/${portfolioId}`;
    let portfolio = Portfolio(btcTotal, eurTotal, path);
    portfolio.currentTime = prices[0][0];
    portfolioStore[portfolioId] = portfolio;
    fs.mkdirSync(path);
    fs.writeFileSync(`${path}/portfolio.json`, JSON.stringify(portfolioStore[portfolioId]));
    fs.writeFileSync(`${path}/orders.json`, JSON.stringify({orders: []}));
    calcVal(portfolioId, portfolio.currentTime);
    return portfolioId
}


// Current portfolio status
function calcVal(id, time) {
    let btcVal = portfolioStore[id].btcTotal * priceDict[time];
    portfolioStore[id].value = btcVal + portfolioStore[id].eurTotal;
    fs.writeFileSync(`${portfolioStore[id].path}/portfolio.json`, JSON.stringify([portfolioStore[id]]));
}
// const portfolioRefreshInterval = setInterval(calcVal, 100); // Portfolio is refreshed when needed

// Save portfolios
function savePortfolio() {
    let fileContents = JSON.stringify(portfolioStore);
    fs.writeFile(portfolioDataFilename, fileContents, () => { return false });
}
const portfolioSaveInterval = setInterval(savePortfolio, 500);


// Logging routines

// Order logging
// Logs the order. The info nput contains order info (order size, time, etc.)
function logOrder(portfolioId, info) {
    let path = `${portfolioStore[portfolioId].path}/orders.json`;
    let data = JSON.parse(fs.readFileSync(path));
    data.orders.push(info);
    fs.writeFileSync(path, JSON.stringify(data));
}

// Order routines

// Buy order
// Buy asset according to the given total (EUR) at market price
function buy(total, buyPrice, id) {
    let amount = total / buyPrice; // marketData.currentPrice;
    portfolioStore[id].eurTotal -= total;
    portfolioStore[id].btcTotal += amount;
}

// Sell order
// Sell the given amount of asset at market price
function sell(total, sellPrice, id) {
    let amount = total * sellPrice // marketData.currentPrice;
    portfolioStore[id].btcTotal -= total;
    portfolioStore[id].eurTotal += amount;
}


// Server


// Data endpoint

// Send current market data (live trading)
// TODO: Implement live trading
routerDataStream.get('/current', (req, res) => {
    let body = {
        time: marketData.currentTime,
        price: marketData.currentPrice
    };
    res.status(200).send(body);
});

// Get specific price
routerDataStream.get('/price', (req, res) => {
    let time = req.body.time;
    if (req.body.time == null) {
        time = portfolioStore[req.body.id].currentTime + marketData.timeIntervalAbsolute;
        portfolioStore[req.body.id].currentTime = time;
    }
    let body = {
        price: priceDict[time],
        interval: marketData.timeIntervalAbsolute
    };
    calcVal(req.body.id, time);
    res.status(200).send(body);
});


// TODO: Improve response text
// Order endpoints
// TODO: Add insufficient balance check

// Buy order
routerMarketOrders.post('/buy', (req, res) => {
    let total = parseFloat(req.body.total);
    let time = portfolioStore[req.body.id].currentTime; // Time of the client
    let buyPrice = priceDict[time]; // Buying price
    let info = {
        type: 'buy',
        total: total,
        time: time,
        price: buyPrice
    }
    buy(total, buyPrice, req.body.id); // Execute order
    time = portfolioStore[req.body.id].currentTime + marketData.timeIntervalAbsolute;
    portfolioStore[req.body.id].currentTime = time;
    calcVal(req.body.id, time); // Recalculate porfolio value
    info['portfolio'] = portfolioStore[req.body.id]
    logOrder(req.body.id, info);
    res.status(200).send(portfolio);
});

// Sell order
routerMarketOrders.post('/sell', (req, res) => {
    let total = parseFloat(req.body.total);
    let time = portfolioStore[req.body.id].currentTime;
    let sellPrice = priceDict[time]; // Selling price
    let info = {
        type: 'sell',
        total: total,
        time: time,
        price: sellPrice
    }
    sell(total, sellPrice, req.body.id); // Execute order
    time = portfolioStore[req.body.id].currentTime + marketData.timeIntervalAbsolute;
    portfolioStore[req.body.id].currentTime = time;
    calcVal(req.body.id, time, req.body.id); // Recalculate porfolio value
    info['portfolio'] = portfolioStore[req.body.id]
    logOrder(req.body.id, info);
    res.status(200).send(portfolio);
});


// Portfolio endpoints

// Set portfolio

// Set portfolio
routerPortfolio.post('/', (req, res) => {
    let input = {
        btc: parseFloat(req.body.btc),
        eur: parseFloat(req.body.eur)
    };
    let id = portfolioCreate(input.btc, input.eur);
    let body = {
        portfolio: portfolioStore[id],
        interval: marketData.timeIntervalAbsolute,
        id: id
    };
    console.log(portfolioStore);
    res.status(200).send(body);
});


// Send current portfolio data
routerPortfolio.get('/', (req, res) => {
    let body = portfolioStore[req.body.id];
    res.status(200).send(body);
});


// Supervisor endpoints


// Portfolio ids
routerSupervisor.get('/ids', (req, res) => {
    let resBody = {
        ids: Object.keys(portfolioStore)
    };
    res.status(200).send(resBody);
})

// Initialize server
let listener = app.listen(8088, () => {
    console.log(`Server listening on port ${listener.address().port}`);
    console.log(`Number of prices = ${prices.length}`);
});