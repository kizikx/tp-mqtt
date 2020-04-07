//
// Cote UI de l'application "lucioles"
//
// Auteur : G.MENEZ
// RMQ : Manipulation naive (debutant) de Javascript
// 
window.onload = function init() {
    let myData = [];
    macList = [];

    function searchMac(mac){
        const index = macList.indexOf(mac);
        if (index == -1) {
        macList.push(mac);
        myData.push({mac, temp: 0, light: 0});
        return macList.length - 1;
        } else {
        return index;
        }
    }

    function replaceData(data){
        for(i=0;i<data.length;i++){
            $("#num"+i).text("Esp"+i);
            $("#mac"+i).text(data[i].mac);
            $("#temp"+i).text(data[i].temp);
            $("#light"+i).text(data[i].light);
        }
    }
    
    //=== Initialisation des traces/charts de la page html

    // Apply time settings globally
    Highcharts.setOptions({
	global: { // https://stackoverflow.com/questions/13077518/highstock-chart-offsets-dates-for-no-reason
            useUTC: false,
            type: 'spline'
	},
	time: {
	    timezone: 'Europe/Paris'
	}
    });

    // cf https://jsfiddle.net/gh/get/library/pure/highcharts/highcharts/tree/master/samples/highcharts/demo/spline-irregular-time/
    var chart1 = new Highcharts.Chart({
        title: {
            text: 'Temperatures'
        },
	subtitle: {
            text: 'Irregular time data in Highcharts JS'
	},
        legend: {
            //title: {
            //    text: 'Temperatures'
            //},
            enabled: true
        },
        credits: false,
        chart: {renderTo: 'container1'},
        xAxis: {
            title: {
                text: 'Heure'
            },
            type: 'datetime'
        },
        yAxis: {
            title: {
                text: 'Temperature (Deg C)'
            }
        },
        series: [{name: 'ESP1', data: []},
		 {name: 'ESP2', data: []},
		 {name: 'ESP3', data: []},
		],

	//colors: ['#6CF', '#39F', '#06C', '#036', '#000'],
	colors: ['red', 'green', 'blue'],
	
        plotOptions: {
            line: {
                dataLabels: {
                    enabled: true
                },
                //color: "red",
                enableMouseTracking: true
            }
        }
    });

    var chart2 = new Highcharts.Chart({
        title: { text: 'Lights' },
        legend: {
            //title: {
            //    text: 'Lights'
            //},
            enabled: true
        },
        credits: false,
        chart: {renderTo: 'container2'},
        xAxis: {
            title: {
                text: 'Heure'
            },
            type: 'datetime'
        },
        yAxis: {
            title: {
                text: 'Lumen (Lum)'
            }
        },
	series: [{name: 'ESP1', data: []},
		 {name: 'ESP2', data: []},
		 {name: 'ESP3', data: []}],

	//colors: ['#6CF', '#39F', '#06C', '#036', '#000'],
	colors: ['red', 'green', 'blue'],
	
        plotOptions: {
            line: {
                dataLabels: {
                    enabled: true
                },
                enableMouseTracking: true
            }
        }
    });

    
    //=== Recuperation dans le Node JS server des samples de l'ESP et 
    //=== Alimentation des charts ====================================

    function get_samples(path_on_node, serie, wh){
	// path_on_node => help to compose url to get on Js node
	// serie => for choosing chart/serie on the page
	// wh => which esp do we want to query data
	
	//node_url = 'http://localhost:3000'
	//node_url = 'http://10.9.128.189:3000'
   // node_url = 'http://192.168.0.2:3000'
    node_url = 'http://62.210.139.84:3000'
    let topic = path_on_node.split("/")[2];

	//https://openclassrooms.com/fr/courses/1567926-un-site-web-dynamique-avec-jquery/1569648-le-fonctionnement-de-ajax
        $.ajax({
            url: node_url.concat(path_on_node), // URL to "GET" : /esp/temp ou /esp/light
            type: 'GET',
            headers: { Accept: "application/json", },
	    data: {"who": wh}, // parameter of the GET request
            success: function (resultat, statut) { // Anonymous function on success
                let listeData = [];
                resultat.forEach(function (element) {
            listeData.push([Date.parse(element.date),element.value]);
		    //listeData.push([Date.now(),element.value]);
                });
                serie.setData(listeData); //serie.redraw();
                console.log(wh);
                let pos = searchMac(wh);
                let newObject = myData[pos];
                console.log(newObject);
                if(topic === "temp"){
                    newObject.temp=topic + serie.data[serie.data.length - 1].y;
                }
                else{
                    newObject.temp=topic + serie.data[serie.data.length - 1].y;
                }
            },
            error: function (resultat, statut, erreur) {
            },
            complete: function (resultat, statut) {
            }
        });
        displayEsp(myData);
     //   replaceData(myData);
    }

    //=== Installation de la periodicite des requetes GET=============
    
    function process_esp(which_esps,i){
	const refreshT = 100000 // Refresh period for chart
	esp = which_esps[i];    // L'ESP "a dessiner"
	//console.log(esp) // cf console du navigateur
	
	// Gestion de la temperature
	// premier appel pour eviter de devoir attendre RefreshT
	get_samples('/esp/temp', chart1.series[i], esp);
	//calls a function or evaluates an expression at specified
	//intervals (in milliseconds).
	window.setInterval(get_samples,
			   refreshT,
			   '/esp/temp',     // param 1 for get_samples()
			   chart1.series[i],// param 2 for get_samples()
			   esp);            // param 3 for get_samples()

	// Gestion de la lumiere
	get_samples('/esp/light', chart2.series[i], esp);
	window.setInterval(get_samples,
			   refreshT,
			   '/esp/light',     // URL to GET
			   chart2.series[i], // Serie to fill
			   esp);             // ESP targeted
    }
    

    //=== Gestion de la flotte d'ESP =================================

    var which_esps = ["80:7D:3A:FD:D7:78",
		      "80:7D:3A:FD:C2:F0",
              "30:AE:A4:8C:04:64"
            ]
    for (var i = 0; i < which_esps.length; i++) {
	process_esp(which_esps, i)
    }
};

function displayEsp(data){
    let table = '<table class="table"><thead><tr><th scope="col">Esp</th><th scope="col">Mac</th><th scope="col">Temp</th><th scope="col">Light</th><th scope="col">Ping</th></tr></thead><tbody>';
    for(let i=0;i<data.length;i++){
        table += '<tr>'+
        '<th id="num'+i+'"> scope="row"></th>'+
        '<td id="mac'+i+'"></td>'+
        '<td id="temp'+i+'"></td>'+
        '<td id="light'+i+'"></td>'+
        '<td><button>ping</button></td>'+
      '</tr>';
    }
    table += '</tbody></table>';
    $('#toto').append(table);
}
