/*
 * Auteur : G.Menez
 */
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h> // by Benoit Blanchon
#include <Wire.h>
#include "OneWire.h"
#include "DallasTemperature.h"
#include "net_misc.h"

/*============= GPIO ======================*/
const int ledPin = 19; // LED Pin
const int photo_resistor_pin = A0;
OneWire oneWire(23);
DallasTemperature tempSensor(&oneWire);
boolean ledAllumee = false;

WiFiClient espClient; // Wifi
PubSubClient client(espClient) ; // MQTT client

String whoami; // Identification de CET ESP au sein de la flotte

//StaticJsonBuffer<200> jsonBuffer;

/*===== MQTT broker/server and TOPICS ========*/
const char* mqtt_server = "broker.hivemq.com";
#define TOPIC_TEMP "luciolesbleues/sensors/temp"
#define TOPIC_LED "luciolesbleues/sensors/led"
#define TOPIC_LIGHT "luciolesbleues/sensors/light"
#define TOPIC_PING "luciolesbleues/ping"

/*=============== SETUP =====================*/

void connect_wifi() {
  const char* ssid = "CB501";
  const char *password= "0000000000";
  
  Serial.println("Connecting Wifi...");
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    Serial.println("Attempting to connect Wifi ..");
    delay(1000);
  }
  Serial.print("Connected to local Wifi\n");
  print_connection_status();
}

void print_connection_status() {
  Serial.print("WiFi status : \n");
  Serial.print("\tIP address : ");
  Serial.println(WiFi.localIP());
  Serial.print("\tMAC address : ");
  Serial.println(WiFi.macAddress());
}

void setup () {
  // Gpio
  pinMode (ledPin , OUTPUT);
  // Serial
  Serial.begin (9600);
  
  /* Wifi */
  connect_wifi();
  
  /*  L'ESP est un client du mqtt_server */
  client.setServer(mqtt_server, 1883);
  // set callback when publishes arrive for the subscribed topic
  // methode a effet local => on n'a pas a initier/verifier la connection.
  client.setCallback(mqtt_pubcallback) ;

  /* Choix d'une identification pour cet ESP ---*/
  // whoami = "esp1"; 
  whoami =  String(WiFi.macAddress());
}

/*============== MQTT CALLBACK ===================*/

void mqtt_pubcallback(char* topic, byte* message, unsigned int length) {
  /* 
   *  Callback if a message is published on this topic.
   */
  
  // Byte list to String ... plus facile a traiter ensuite !
  // Mais sans doute pas optimal en performance => heap ?
  String messageTemp ;
  for(int i = 0 ; i < length ; i++) {
    messageTemp += (char) message[i];
  }
  
  Serial.print("Message : ");
  Serial.println(messageTemp);
  Serial.print("arrived on topic : ");
  Serial.println(topic) ;
 
  // Analyse du message et Action 
  if(String (topic) == TOPIC_LED) {
     // Par exemple : Changes the LED output state according to the message   
    Serial.print("Action : Changing output to ");
    if(messageTemp == "on") {
      Serial.println("on");
      set_pin(ledPin,HIGH);
     
    } else if (messageTemp == "off") {
      Serial.println("off");
      set_pin(ledPin,LOW);
    }
  } else if (String(topic) == TOPIC_PING) {
    StaticJsonBuffer<200> jsonBuffer;
    JsonObject &root = jsonBuffer.parseObject(messageTemp);
    if (!root.success()) {
      Serial.println("parseObject() failed");
      return;
    }
    String who = root["who"];
    if (who == whoami) {
      ledAllumee = true;
      set_pin(ledPin, HIGH);
    }
  }
}

/*============= MQTT SUBSCRIBE =====================*/

void mqtt_mysubscribe(char* topic) {
  /*
   * ESP souscrit a ce topic. Il faut qu'il soit connecte.
   */
  while(!client.connected()) { // Loop until we are reconnected
    Serial.print("Attempting MQTT connection...");
    char id[17];
    whoami.toCharArray(id, 17);
    if(client.connect(id, "try", "try")) { // Attempt to connect 
      Serial.println("connected");
      client.subscribe(topic); // and then Subscribe
    } else { // Connection failed
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println("try again in 5 seconds");
      // Wait 5 seconds before retrying
      delay(5*1000);
    }
  }
}

/*============= ACCESSEURS ====================*/

float get_temperature() {
  float temperature;
  tempSensor.requestTemperaturesByIndex(0);
  delay (750);
  temperature = tempSensor.getTempCByIndex(0);
  return temperature;
}

float get_light(){
  return analogRead(photo_resistor_pin);
}

void set_pin(int pin, int val){
 digitalWrite(pin, val) ;
}

int get_pin(int pin){
  return digitalRead(pin);
}

/*================= LOOP ======================*/
void loop () {
  char data[80];
  String payload; // Payload : "JSON ready" 
  int32_t period = 10 * 1000l; // Publication period
  
  /* Subscribe to TOPIC_LED if not yet ! */
  if (!client.connected()) {
    // mqtt_mysubscribe((char*) (TOPIC_LED));
    mqtt_mysubscribe((char*) (TOPIC_PING));
  }
  
  /* Publish Temperature & Light periodically */
  payload = "{\"who\": \"";
  payload += whoami;   
  payload += "\", \"value\": " ;
  payload += get_temperature(); 
  payload += "}";
  
  payload.toCharArray(data, (payload.length() + 1)); // Convert String payload to a char array
  Serial.println(data);
  client.publish(TOPIC_TEMP, data);  // publish it 

  payload = "{\"who\": \"" + whoami + "\", \"value\": " + get_light() + "}";
  payload.toCharArray(data, (payload.length() + 1));
  Serial.println(data);
  client.publish(TOPIC_LIGHT, data);

  if (get_light() < 100 && ledAllumee) {
    ledAllumee = false;
    set_pin(ledPin, LOW);
  }

  delay(period);
  client.loop(); // Process MQTT ... obligatoire une fois par loop()
}
