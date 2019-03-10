var cheerio = require('cheerio');
var request = require('request');
var jsonframe = require('jsonframe-cheerio');

let frameCourses = {
	"root": {
		"_s": "article",
		"_d": [{
			"url": ".media-body a @ href"
		}]
	}
};

let options = {
    url: 'https://www.le-sportif.com/Calendar/CalendarSearch.aspx',
    method: 'POST',
    body: JSON.stringify({
        '__EVENTTARGET': 'ctl00$ContentPlaceHolder_Content$ListView_Calendar_Event_List$DataPager_Calendar_Event_List$ctl01$ctl05',
        'ctl00$ToolkitScriptManager': 'ctl00$ContentPlaceHolder_Content$UpdatePanel_Calendar_4leftcols|ctl00$ContentPlaceHolder_Content$ListView_Calendar_Event_List$DataPager_Calendar_Event_List$ctl01$ctl05'
    })
};

request(options, function (error, response, html) {
    
    if (!error && response.statusCode == 200) {

        let $ = cheerio.load(html);
        jsonframe($);
        let articles = $('body').scrape(frameCourses);
        console.log(articles);

    }
});


    

