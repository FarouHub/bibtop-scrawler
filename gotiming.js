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
console.log('Connect to mongodb: ' + config.mongodb);

// Info de navigation
var $navInfo = [];
$navInfo['page'] = {};
$navInfo['page']['rootPage'] = 'https://www.gotiming.fr';
$navInfo['page']['addRoot'] = true;
$navInfo['page']['currentPage'] = 'https://www.gotiming.fr/evenement';
$navInfo['page']['degraded'] = 0;
$navInfo['proxies'] = config.proxies;

// Recupere les infos sur la page qui liste les liens vers les détails (notamment l'url des détails)
let frameCourses = {
	"root": {
		"_s": ".eb-taskbar",
		"_d": [{
			"url": "a.btn.btn-default.btn-primary @ href"
		}]
	}
};

// Recupere les info sur la page de détail
let frameCourse = {
	"root": {
		"_s": "#eb-event-page",
		"_d": [{
			"title": ".eb-page-heading",
			"title_req": ".eb-page-heading | no_accent words_no_space uppercase",
			"date": "td:contains('Date de') + td",
			"debut_inscriptions": "td:contains('Début des') + td",
			"fin_inscriptions": "td:contains('Fin des') + td",
			"email": "td:contains('Email') + td",
			"Inscription": "td:contains('Inscription') + td",
			"commune": "td:contains('Lieu') + td",
			"commune_req": "td:contains('Lieu') + td | no_accent words_no_space uppercase",
			"next": "a:contains('S') @ href"
			
		}]
	}
};

// Recupere l'url vers la page suivante
let frameNextPageUrl = null;

let scrawler = new BibScrawler();

let logger = scrawler.load('gotiming', frameCourses, frameCourse, frameNextPageUrl);

scrawler.parser_site($navInfo, function(homeInfo, item, next){
	item.random = Math.floor((Math.random() * 9) + 1);

	console.log(item);
	next();
});
