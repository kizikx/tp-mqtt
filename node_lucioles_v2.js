// Importation des modules
var path = require('path');

// var, const, let :
// https://medium.com/@vincent.bocquet/var-let-const-en-js-quelles-diff%C3%A9rences-b0f14caa2049

const mqtt = require('mqtt')
// Topics MQTT
const TOPIC_LIGHT = 'luciolesbleues/sensors/light'
const TOPIC_TEMP  = 'luciolesbleues/sensors/temp'

// express 
const express = require('express');
const bodyParser = require('body-parser');

const app = express();
//Pour permettre de parcourir les body des requetes
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())
app.use(express.static(path.join(__dirname, '/')));
app.use(function(request, response, next) { //Pour eviter les problemes de CORS/REST
    response.header("Access-Control-Allow-Origin", "*");
    response.header("Access-Control-Allow-Headers", "*");
    response.header("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE");
    next();
});

// MongoDB
var mongodb = require('mongodb');
const mongoBaseName = "lucioles"                   // Nom de la base
//const uri = 'mongodb://localhost:27017/'; //URL de connection
const uri = 'mongodb+srv://heroku:if\@9FyQ8GtR6pm@iot-goltu.mongodb.net/lucioles?retryWrites=true&w=majority';
//const uri = 'mongodb://10.9.128.189:27017/'; //URL de connection		
//const uri = "mongodb+srv://menez:mettrelevotre@cluster0-x0zyf.mongodb.net/test?retryWrites=true&w=majority";

const MongoClient = require('mongodb').MongoClient;
const client = new MongoClient(uri, { useNewUrlParser: true });

// Connection a la DB MongoDB 
client.connect(function(err,  mongodbClient){
    if(err) throw err; // If connection to DB failed ... 
                       // else we get a "db" engine reference
    
    //===============================================    
    // Get a connection to the DB "lucioles" or create
    //
    var dbo = client.db(mongoBaseName);
   /* 
    dbo.dropCollection("temp", function(err, delOK) {
	if (err) console.error(err);
	if (delOK) console.log("Collection deleted");
    });

    dbo.dropCollection("light", function(err, delOK) {
	if (err) console.error(err);
	if (delOK) console.log("Collection deleted");
    });
*/
    //===============================================
    // Connection au broker MQTT distant
	//
	//const mqtt_url = '134.59.131.45:1883';
	//const mqtt_url = 'http://127.0.0.1';
	//const mqtt_url = 'http://192.168.1.100:1883' ///134.59.131.45:1883'
    const mqtt_url = 'http://broker.hivemq.com'
    var client_mqtt = mqtt.connect(mqtt_url);
    
    //===============================================
    // Des la connection, le serveur NodeJS s'abonne aux topics MQTT 
    //
    client_mqtt.on('connect', function () {
	client_mqtt.subscribe(TOPIC_LIGHT, function (err) {
	    if (!err) {
		//client_mqtt.publish(TOPIC_LIGHT, 'Hello mqtt')
		console.log('Node Server has subscribed to ', TOPIC_LIGHT);
	    }
	})
	client_mqtt.subscribe(TOPIC_TEMP, function (err) {
	    if (!err) {
		//client_mqtt.publish(TOPIC_TEMP, 'Hello mqtt')
		console.log('Node Server has subscribed to ', TOPIC_TEMP);
	    }
	})
    })

    //================================================================
    // Callback de la reception des messages MQTT pour les topics sur
    // lesquels on s'est inscrit.
    // C'est cette fonction qui alimente la BD.
    //
    client_mqtt.on('message', function (topic, message) {
		console.log("MQTT msg on topic : ", topic.toString());
		console.log("Msg payload : ", message.toString());

		// Parsing du message suppos� recu au format JSON
		message = JSON.parse(message);
		wh = message.who
		val = message.value

		// Debug : Gerer une liste de who pour savoir qui utilise le node server	
		let wholist = []
		var index = wholist.findIndex(x => x.who==wh)
		if (index === -1){
			wholist.push({who:wh});	    
		}
		console.log("wholist using the node server :", wholist);
		
		// Mise en forme de la donnee � stocker => dictionnaire
		// Le format de la date est iomportant => copatible avec le
		// parsing qui sera realise par hightcharts dans l'UI
		// cf https://www.w3schools.com/jsref/tryit.asp?filename=tryjsref_tolocalestring_date_all
		// vs https://jsfiddle.net/BlackLabel/tgahn7yv
		//var frTime = new Date().toLocaleString("fr-FR", {timeZone: "Europe/Paris"});
		var frTime = new Date().toLocaleString("sv-SE", {timeZone: "Europe/Paris"});
		var new_entry = { date: frTime, // timestamp the value 
				who: wh,      // identify ESP who provide 
				value: val    // this value
				};
		
		// On recupere le nom du topic du message
		var topicname = path.parse(topic.toString()).base;

		// Stocker la donnee/value contenue dans le message en
		// utilisant le nom du topic comme key dans la BD
		key = topicname
		dbo.collection(key).insertOne(new_entry, function(err, res) {
			if (err) throw err;
			console.log("Item inserted in db in collection :", key);
			console.log(new_entry);
		});

		// Debug : voir les collections de la DB 
		/* dbo.listCollections().toArray(function(err, collInfos) {
			// collInfos is an array of collection info objects that look like:
			// { name: 'test', options: {} }
			console.log("\nList of collections currently in DB: ", collInfos); 
		}); */
    }) // end of 'message' callback installation

    //================================================================
    // Fermeture de la connexion avec la DB lorsque le NodeJS se termine.
    //
    process.on('exit', (code) => {
	if (mongodbClient && mongodbClient.isConnected()) {
	    console.log('mongodb connection is going to be closed ! ');
            mongodbClient.close();
	}
    })
    
    //================================================================
    //==== REQUETES HTTP reconnues par le Node =======================
    //================================================================
    
    // Acc�s par le Node a la page HTML affichant les charts
    app.get('/', function (req, res) {
	res.sendFile(path.join(__dirname + '/ui_lucioles.html'));
    });

    // Function for answering GET request on this node server ...
    // probably from navigator.
    // The request contains the name of the targeted ESP !
    //     /esp/temp?who=80%3A7D%3A3A%3AFD%3AC9%3A44
    // Utilisation de routes dynamiques => meme fonction pour
    // /esp/temp et /esp/light
    app.get('/esp/:what', function (req, res) {
	// cf https://stackabuse.com/get-query-strings-and-parameters-in-express-js/
	console.log(req.originalUrl);
	
	wh = req.query.who // get the "who" param from GET request
	                   // => gives the Id of the ESP we look for in the db	
	wa = req.params.what // get the "what" from the GET request : temp or light ?

	console.log("\n--------------------------------");
	console.log("A client/navigator ", req.ip);
        console.log("sending URL ",  req.originalUrl);
	console.log("wants to GET ", wa);
	console.log("values from object ", wh);
	
	const nb = 200; // R�cup�ration des nb derniers samples
	                // stock�s dans la collection associ�e a ce
	                // topic (wa) et a cet ESP (wh)
	key = wa
	//dbo.collection(key).find({who:wh}).toArray(function(err,result) {
	dbo.collection(key).find({who:wh}).sort({_id:-1}).limit(nb).toArray(function(err, result) {
	    if (err) throw err;
	    console.log('get on ', key);
	    console.log(result);
	    res.json(result.reverse()); // This is the response.
	    console.log('end find');
	});
	console.log('end app.get');
    });

});// end of MongoClient.connect


// L'application est accessible sur le port 3000
app.listen(process.env.PORT || 3000, () => {
    console.log('Server listening on port 3000');
});
