// Importation des modules
var path = require('path');

// var, const, let :
// https://medium.com/@vincent.bocquet/var-let-const-en-js-quelles-diff%C3%A9rences-b0f14caa2049

const mqtt = require('mqtt')
// Topics MQTT
const TOPIC_LIGHT = 'sensors/light'
const TOPIC_TEMP  = 'sensors/temp'

// MongoDB
var mongodb = require('mongodb');
const mongoName = "lucioles"                   // Nom de la base
const mongoURL = 'mongodb://localhost:27017/'; //URL de connection		

// Connection a la DB MongoDB 
mongodb.MongoClient.connect(mongoURL, {useNewUrlParser: true}, function(err,  mongodbClient){
    if(err) throw err; // If connection to DB failed ... 
                       // else we get a "db" engine reference
    
    //===============================================    
    // Get a connection to the DB "lucioles" or create
    //
    var dbo = mongodbClient.db(mongoName);
    
    //===============================================
    // Connection au broker MQTT distant
    //
    const mqtt_url = 'http://192.168.1.100:1883'
    var client_mqtt = mqtt.connect(mqtt_url);
    
    //===============================================
    // Des la connection, le serveur NodeJS s'abonne aux topics MQTT 
    //
    client_mqtt.on('connect', function () {
	client_mqtt.subscribe(TOPIC_LIGHT, function (err) {
	    if (!err) {
		//client_mqtt.publish(TOPIC_LIGHT, 'Hello mqtt')
		console.log('Server has subscribed to ', TOPIC_LIGHT);
	    }
	})
	client_mqtt.subscribe(TOPIC_TEMP, function (err) {
	    if (!err) {
		//client_mqtt.publish(TOPIC_TEMP, 'Hello mqtt')
		console.log('Server has subscribed to ', TOPIC_TEMP);
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

	// Parsing du message supposé recu au format JSON
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
	
	// Mise en forme de la donnee à stocker => dictionnaire
	var frTime = new Date().toLocaleString("fr-FR", {timeZone: "Europe/Paris"});
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
	dbo.listCollections().toArray(function(err, collInfos) {
	    // collInfos is an array of collection info objects that look like:
	    // { name: 'test', options: {} }
	    console.log("List of collections currently in DB: ", collInfos); 
	});
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
    
});// end of MongoClient.connect
