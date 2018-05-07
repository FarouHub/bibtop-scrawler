var config = require("./config");
let BibScrawler = require('./scrawler');
var mongoose = require('mongoose');
var epreuveModel = require('./api/models/epreuveModel');
var villeModel = require('./api/models/villeModel');

var Ville = mongoose.model('ville');
var Epreuve = mongoose.model('epreuve');

// mongoose instance connection url connection
mongoose.Promise = global.Promise;
mongoose.connect(config.mongodb);

// Info de navigation
var $navInfo = [];
$navInfo['page'] = {};
$navInfo['page']['rootPage'] = 'http://www.jogging-international.net';
$navInfo['page']['addRoot'] = true;
$navInfo['page']['currentPage'] = 'http://www.jogging-international.net/courses/calendrier?fs=1&q=&date_begin=&date_end=&country_code=FR';
$navInfo['page']['degraded'] = 0;
$navInfo['proxies'] = config.proxies;

// Recupere les infos sur la page qui liste les liens vers les détails (notamment l'url des détails)
let frameCourses = {
	"root": {
		"_s": "article",
		"_d": [{
			"name": ".date-result + a @ title",
			"date": ".date-result",
			"url": ".date-result + a @ href"
		}]
	}
};

// Recupere les info sur la page de détail
let frameCourse = {
	"root": {
		"_s": "section article",
		"_d": [{
			"title": "h1",
			"date": "[itemprop=articleBody] ul li || : (.*)",
			"region": "[itemprop=articleBody] ul + ul li || : (.*)",
			"commune": "[itemprop=articleBody] ul + ul li + li || : (.*) | before(()",
			"commune_req": "[itemprop=articleBody] ul + ul li + li || : (.*) | before(() | no_accent words_no_space uppercase",
			"codepostal": "[itemprop=articleBody] ul + ul li + li || : (.*) ",
			"place_depart": "[itemprop=articleBody] ul + ul li + li + li || : (.*)",
			"service" : "h2:contains('Services') + ul li:contains('Service') || : (.*)",
			"recompences" : "h2:contains('Services') + ul li:contains('Récompenses') || : (.*)",
			"animation" : "h2:contains('Services') + ul li:contains('Animation') || : (.*)",
			"contact": "h2:contains('Contact') + div li:contains('Contact') || : (.*)",
			"phone": "h2:contains('Contact') + div li:contains('Tél') || : (.*)",
			"mail": "h2:contains('Contact') + div li:contains('Email') || : (.*)",
			"url_club": ".bt-jog @ href",
			"_epreuves_": {
			"_s": ".jog-data-tab tr",
			"_d": [{"name": "span || - (.*)",
					"distance": "span || ([\\d,\\.]+)",
					"type": "th < html | after(span>)",
					"divers": "ul"
					}]
			}
		}]
	}
};

// Recupere l'url vers la page suivante
let frameNextPageUrl = {
	"next": ".prev-next a[rel=next] @ href"
};


let scrawler = new BibScrawler();

scrawler.load('jogging_international', frameCourses, frameCourse, frameNextPageUrl);

scrawler.parser_site($navInfo, function(item, next){
	console.log(item.title);
	next();
});