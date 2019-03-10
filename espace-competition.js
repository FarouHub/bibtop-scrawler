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
$navInfo['page']['rootPage'] = 'http://www.espace-competition.com/v2/';
$navInfo['page']['addRoot'] = true;
$navInfo['page']['currentPage'] = 'http://www.espace-competition.com/v2/index.php?module=sport&action=agenda&mois=-1';
$navInfo['page']['degraded'] = 0;
$navInfo['proxies'] = config.proxies;

// Recupere les infos sur la page qui liste les liens vers les détails (notamment l'url des détails)
let frameCourses = {
	"root": {
		"_s": ".disabled",
		"_d": [{
			"url": "td + td + td a @ href",
			"start_date": "td"
		}]
	}
};

// Recupere les info sur la page de détail
let frameCourse = {
	"root": {
		"_s": ".panel-body",
		"_d": [{
			"adress": "h5:contains('Lieu') + p",
			"adress2": "h5:contains('Lieu') + p + p",
			"description": "h5:contains('Description') + p",
			"reglement": "h5:contains('Règlement') + p a @ href",
			"url_club": "h5:contains('Site') + p a @ href",
			"_epreuves_": {
						"_s": ".panel.panel-default",
						"_d": [{"name": "h4",
								"start_hour": "span[class=badge]",
								"tarif": "label:contains('Tarif') + div p"
								}]
						}
		}]
	}
};

// Recupere l'url vers la page suivante
let frameNextPageUrl = null;

let scrawler = new BibScrawler();

let logger = scrawler.load('espace-competition', frameCourses, frameCourse, frameNextPageUrl);

scrawler.parser_site($navInfo, function(homeInfo, item, next){
	homeInfo.random = Math.floor((Math.random() * 9) + 1);

	homeInfo.start_date = homeInfo.start_date.substring(6, 10) + '-' + homeInfo.start_date.substring(3, 5) + '-' + homeInfo.start_date.substring(0, 2);

	// management de la zone divers
	let cacheType = 'Standard';

	Epreuve.find({ urlid: homeInfo.url }, function(err, findResult) {
		if (err){
			logger.error('Unable to find the race. URL %s', homeInfo.url, err);
			next();
		}else{
			if(findResult.length == 0){
				/// try to find the town
				Ville.find({ SORT_NAME_RO: homeInfo.commune_req, NAME_RANK: '1' }, function(err, findVilleResult) {
					if (err){
						logger.error('Unable to find the city. URL %s', homeInfo.url, { SORT_NAME_RO: homeInfo.commune_req }, err);
						next();
					}else{
						if(findVilleResult.length == 0){
							logger.error("La ville %s n'a pas été trouvée dans la base. URL %s", homeInfo.commune_req, homeInfo.url);
							next();
						}else if(findVilleResult.length > 1){
							logger.error("La ville %s a été trouvée en plusieurs exemplaires dans la base. URL %s", homeInfo.commune_req, homeInfo.url);
							next();
						}else{
							//console.log('lat: ' + findVilleResult[0].LAT + ' long: ' + findVilleResult[0].LONG);
							item.lat =  findVilleResult[0].LAT;
							item.long =  findVilleResult[0].LONG;

							var mEp = new epreuveModel(Object.assign(homeInfo, item));
							let debug = true;
							if(debug){
								mEp.save(function(err){
									if (err){
										logger.error('Unable to save the epreuve.', err);
									}
								});
							}else{
								console.log(mEp);
							}

							next();
						}
					}
				});
			}else{
				logger.info("Le document %s existe deja", homeInfo.url);
				next();
			}
		}
	});
	next();
});