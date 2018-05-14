'use strict';

var cheerio = require('cheerio');
var request = require('request');
var jsonframe = require('jsonframe-cheerio');
var winston = require('winston');

let BibScrawler = (function () {

    // inteval avant dappeler une page suivante
    let _timeinterval = 2000; // 5s

    let httpHeader = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.100 Safari/537.36'
    };

    /**
     * Constructor 
     */
    function BibScrawler() {

    }

    BibScrawler.prototype.load = function(name, frameItems, frameItem, frameNextPageUrl){

        this._name = name;
        // init the logger
        this.logger = new (winston.Logger)({
            transports: [
                new (winston.transports.Console)({ name: this._name + '_console', colorize: true, level: 'debug' }),
                new (winston.transports.File)({ name: this._name + '_log', filename: 'logs/' + this._name + '.log', level: 'info' }),
                new (winston.transports.File)({ name: this._name + '_error', filename: 'logs/' + this._name + '_error.log', level: 'error' }),
            ]
        });
        this._frameItems = frameItems;
        this._frameItem  = frameItem;
        this._frameNextPageUrl = frameNextPageUrl;
    }

    /**
     * 
     * @param {*} navInfo 
     */
    BibScrawler.prototype.parser_site = function(navInfo, itemHandler) {
        // choice between my 10 proxies
        let randomProxy = Math.floor((Math.random() * (navInfo['proxies'].length - 1)) + 1);
        let options = {
            url: navInfo['page']['currentPage'],
            proxy: navInfo['proxies'][randomProxy],
            headers: httpHeader
        };

        // this changed below because of request
        let context = this;
       
        this.logger.info('Open page URL: %s on proxy %s', options.url, options.proxy);
        request(options, function (error, response, html) {
    
            if (!error && response.statusCode == 200) {
                // parsing the html page with cheerio
                let $ = cheerio.load(html);
                jsonframe($);
                
                let articles = $('body').scrape(context._frameItems);
                let nextPage = $('body').scrape(context._frameNextPageUrl);
                
                let index = 0;
                let timeToFinish = 0 ;

                // parsing eatch article one by one
                articles['root'].forEach(function(detail) {
                    if(typeof detail.url != 'undefined') {
                        timeToFinish++;

                        let navInfoArticle = copyArray.call(context, navInfo);
                        
                        if(navInfo['page']['addRoot']){
                            detail.url = navInfo['page']['rootPage'] + detail.url;
                        }
                        
                        navInfoArticle['page']['currentPage'] = detail.url;
                        setTimeout(function(){
                            context.parser_article(navInfoArticle, itemHandler, function(){timeToFinish--;})
                        }, _timeinterval*index);
                    }
                    index++;
                });

                context.logger.debug('Try to get the next page');
                // try to go to the next page
                if(typeof nextPage.next != 'undefined'){
                    
                    if(navInfo['page']['addRoot']){
                        nextPage.next = navInfo['page']['rootPage'] + nextPage.next;
                    }
                    
                    let navInfoNextPage = copyArray.call(context, navInfo);
                    navInfoNextPage['page']['currentPage'] = nextPage.next;
                    
                    waitFor.call(context, function() {
                        // Check in the page if a specific element is now visible
                        return timeToFinish == 0;
                    }, function() {
                        context.logger.debug('Go to the next page: %s', nextPage.next);
                        context.parser_site(navInfoNextPage, itemHandler);
                    });
                }

            } else {
                context.logger.error("Failed to load page URL %s on proxy %s. Error: " + error + ", Statut Code: " + response.statusCode, options.url, options.proxy);
            }
        });
    }

    /**
     * 
     * @param {*} navInfo 
     * @param {*} callback 
     */
    BibScrawler.prototype.parser_article = function(navInfo, itemHandler, callback) {
        var randomProxy = Math.floor((Math.random() * 9) + 1);
        let options = {
            url: navInfo['page']['currentPage'],
            proxy: navInfo['proxies'][randomProxy],
            headers: httpHeader
        };

        console.log(randomProxy);

        // this changed below because of request
        let context = this;
        
        this.logger.info('Open race URL: %s on proxy %s', options.url, options.proxy);
        request(options, function (error, response, html) {
            if (!error && response.statusCode == 200) {
                let $ = cheerio.load(html);
                // initializes the jsonframe-cheerio plugin
                jsonframe($);
                
                let item =  $('body').scrape(context._frameItem);
                item.root[0].urlid = options.url;
                itemHandler(item.root[0], callback);
            }else{
                context.logger.error("Failed to load race URL %s on proxy %s. Error: " + error + ", Statut Code: " + response.statusCode, options.url, options.proxy);
                callback();
            }
        });
    }

    

    /**
     * The method wait on conditions to do something
     * @param {*} testFx String condition or function (need return true or false) you need to test
     * @param {*} onReady String or function you need to execute when testFx is true
     * @param {*} timeOutMillis Time is ms between eatch check of the conditions 
     */
    let waitFor = function(testFx, onReady, timeOutMillis) {

        var context = this;
        var maxtimeOutMillis = timeOutMillis ? timeOutMillis : 300000, //< Default Max Timout is 5 min
            start = new Date().getTime(),
            condition = false,
            interval = setInterval(function() {
                if ( (new Date().getTime() - start < maxtimeOutMillis) && !condition ) {
                    // If not time-out yet and condition not yet fulfilled
                    condition = (typeof(testFx) === "string" ? eval(testFx) : testFx()); //< defensive code
                } else {
                    if(!condition) {
                        // If condition still not fulfilled (timeout but condition is 'false')
                        context.logger.error("'waitFor()' timeout");
                        exit(1);
                    } else {
                        // Condition fulfilled (timeout and/or condition is 'true')
                        context.logger.debug("'waitFor()' finished in " + (new Date().getTime() - start) + "ms.");
                        typeof(onReady) === "string" ? eval(onReady) : onReady(); //< Do what it's supposed to do once the condition is fulfilled
                        clearInterval(interval); //< Stop this interval
                    }
                }
            }, 500); //< repeat check every 250ms
    };

    /**
     * The method copy an array in 2d
     * @param {*} mArr Here the array you need to copy
     */
    let copyArray = function (mArr){
        var $newArr = [];
        Object.keys(mArr).forEach(function(key,index) {
            $newArr[key] = {};
            Object.keys(mArr[key]).forEach(function(key2d,index2d) {
                $newArr[key][key2d] = mArr[key][key2d];
            });
        });
        
        return $newArr;
    }

    return BibScrawler;
})();

module.exports = BibScrawler;