var fs = require('fs');
var MongoClient = require("mongodb").MongoClient;


//Connect to the db
MongoClient.connect("mongodb://spartan:pioupiou123@cluster0-shard-00-00-hfhr2.mongodb.net:27017,cluster0-shard-00-01-hfhr2.mongodb.net:27017,cluster0-shard-00-02-hfhr2.mongodb.net:27017/test?ssl=true&replicaSet=Cluster0-shard-0&authSource=admin", function(error, db) {
	if (error) throw error;
	
	console.log('***************Successfully connected to mongodb');
	var collection  = db.collection('countries');
	var fs          = require('fs');
	var readline    = require('readline');
	var stream      = require('stream');
	var instream    = fs.createReadStream('fr.txt');
	var outstream   = new stream;
	var rl          = readline.createInterface(instream,outstream);

	console.log('***************Parsing, please wait ...');
	rl.on('line',function(line){
		try{
			let arrLine         = line.split('\t');
			let tmpCountry = {
				"RC": arrLine[0],
				"UFI": arrLine[1],
				"UNI": arrLine[2],
				"LAT": arrLine[3],
				"LONG": arrLine[4],
				"DMS_LAT": arrLine[5],
				"DMS_LONG": arrLine[6],
				"MGRS": arrLine[7],
				"JOG": arrLine[8],
				"FC": arrLine[9],
				"DSG": arrLine[10],
				"PC": arrLine[11],
				"CC1": arrLine[12],
				"ADM1": arrLine[13],
				"POP": arrLine[14],
				"ELEV": arrLine[15],
				"CC2": arrLine[16],
				"NT": arrLine[17],
				"LC": arrLine[18],
				"SHORT_FORM": arrLine[19],
				"GENERIC": arrLine[20],
				"SORT_NAME_RO": arrLine[21],
				"FULL_NAME_RO": arrLine[22],
				"FULL_NAME_ND_RO": arrLine[23],
				"SORT_NAME_RG": arrLine[24],
				"FULL_NAME_RG": arrLine[25],
				"FULL_NAME_ND_RG": arrLine[26],
				"NOTE": arrLine[27],
				"MODIFY_DATE": arrLine[28],
				"DISPLAY": arrLine[29],
				"NAME_RANK": arrLine[30], 
				"NAME_LINK": arrLine[31],
				"TRANSL_CD": arrLine[32],
				"NM_MODIFY_DATE": arrLine[33],
				"F_EFCTV_DT": arrLine[34],
				"F_TERM_DT": arrLine[35]

			};
			var res = collection.insert(tmpCountry);
		}catch (err){
			console.log(err);
		}
	});

	rl.on('close',function(){
		db.close();
		console.log('***************completed');
	});
});

