var config = require("./config");
let BibScrawler = require('./scrawler');
var request = require('request');
var fs = require('fs');

// Info de navigation
var $navInfo = [];
$navInfo['page'] = {};
$navInfo['page']['rootPage'] = 'https://www.lesfruitsetlegumesfrais.com';
$navInfo['page']['addRoot'] = true;
$navInfo['page']['currentPage'] = 'https://www.lesfruitsetlegumesfrais.com';
$navInfo['page']['degraded'] = 0;
$navInfo['proxies'] = config.proxies;

// Recupere les infos sur la page qui liste les liens vers les détails (notamment l'url des détails)
let frameCourses = {
	"root": {
		"_s": "ol li",
		"_d": [{
			"url": "a @ href"
		}]
	}
};

// Recupere les info sur la page de détail
let frameCourse = {
	"root": {
		"_s": ".h1-like + .float-right",
		"_d": [{
			"img": "img @ src"
		}]
	}
};

// Recupere l'url vers la page suivante
let frameNextPageUrl = {
	"next": ".prev-next a[rel=next] @ href"
};


let scrawler = new BibScrawler();

scrawler.load('logicourse', frameCourses, frameCourse, frameNextPageUrl);

scrawler.parser_site($navInfo, function(item, next){
	let regex = /\/([a-zA-Z0-9\-_]+)_346_346_filled.jpg$/;
	let nameImg =  item.img.match(regex)[1];
	nameImg = nameImg.replace(' ', '');

	download($navInfo['page']['rootPage'] + '/' + item.img , 'datas/' + nameImg + '.jpg', function(){
		console.log(item.img + ': done');
	});
	next();
});

function download($url, filename, callback){

	let options = {
		url: $url,
		//proxy: navInfo['proxies'][x],
		headers: {
		  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.100 Safari/537.36'
		}
	  };

	request(options).pipe(fs.createWriteStream(filename)).on('close', callback);

};