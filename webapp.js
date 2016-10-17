var express = require('express');
var twitter = require('ntwitter');
var sentiment = require('sentiment');
var request = require('request');
var MongoClient = require('mongodb').MongoClient;

var app = express();
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);
var db;

var tweet = new twitter({
    consumer_key: 'Grrgs6kZCiCULGrsx3zi9ilWn',
    consumer_secret: 'rWpCUZOYOl69KgOydHsqrEIGIe1r6aOHl13o2trqtPShDx3hZG',
    access_token_key: '286684872-PjW2N9e3RrPqKtA919qnJGnVc0SpYIXzjo7RJlcn',
    access_token_secret: 'vTfhlzGCmEVJ44npOV2RbersD6pNRULJLd7JrzGBFrAHR'
});

var filter = 'treebo';
var pos = 0, neg = 0, total = 0;
var fpos = 0, fneg = 0, ftotal = 0;

var options = { 
	method: 'GET',
	url: 'https://graph.facebook.com/v2.8/854212904671990/feed',
	qs: { 
		fields: 'created_time,message,comments,status_type',
		limit: 1,
    	access_token: 'EAAFI0zddyDUBAMfQZBaa850ZB93Q3VZBeZCuRSevayfzJqQBXOehWfylWZBNKCIf7BDMg18uN16tI3ZB2ZA1HRkqigss0tQ1KTXdXjw8R43siz0zV7eQZB1ZAH5vQXFIhBZCqmfGoI0xODzNHXZCNumZAkX9s9rLH4so34oZD' 
  	}
}

var url = 'https://graph.facebook.com/v2.8/854212904671990/feed';

io.on('connection', function (socket) {
	tweet.stream('statuses/filter', {track: filter}, function(stream){
		stream.on('data', function(data){
			if(data.lang === 'en') {
				var textString = '', id = '', screen_name = '', image_url = '';
				textString = data.text;
				id = data.id;
				screen_name = data.user.screen_name;
				image_url = data.user.profile_image_url;

				// (function(localId,localText, name, image){
					sentiment(data.text, function (err, result) {
						db.collection("t_post").find({id: id}).toArray(function(err, docs){
							if(docs.length === 0) {
								newPost = {id: id, text: textString};
								db.collection("t_post").insertOne(newPost);
								var set = 'NEUTRAL'
								if(result.score > 0){
									pos++;
									total++;
									set = 'POSITIVE'
								}

								if(result.score < 0){
									neg++;
									total++;
									set = 'NEGATIVE'
								}
								score = {pos: (pos/total)*100, neg: (neg/total)*100}
								twit = {user: screen_name, image: image_url, text: textString, set: result.score, score: score};
								io.sockets.volatile.emit('tweet', twit);
							}
						});
					});
				// })(id, textString, screen_name, image_url);
			}
		});
	});

	socket.on('error', function (err) {
	    //handle or ignore the error
	});

	setInterval(function(){
		request(options, function (error, response, body) {
			if (error) throw new Error(error);
			var data = JSON.parse(body);
			data = data.data;
			var textString = '', id = '';
		 	for(var i = 0; i < data.length; i++){
				textString = data[i].message;
				id = data[i].id;
				(function(localId,localText, post){
					sentiment(localText, function (err, result) {
						db.collection("fb_post").find({id: localId}).toArray(function(err, docs){
							if(docs.length === 0) {
								newPost = {id: localId, text: localText};
								db.collection("fb_post").insertOne(newPost);
								
								var set = 'NEUTRAL'
								if(result.score > 0){
									fpos++;
									ftotal++;
									set = 'POSITIVE'
								}

								if(result.score < 0){
									fneg++;
									ftotal++;
									set = 'NEGATIVE'
								}
								score = {pos: (fpos/ftotal)*100, neg: (fneg/ftotal)*100};
								fbpost = {link: 'https://facebook.com/' + localId, message: localText, set: result.score, score: score};
								io.sockets.emit('fb', fbpost);
							}
						});
					});
				})(id, textString, data[i]);
				
				// if (data[i].hasOwnProperty("comments")){
				// 	commentsData = data[i]['comments']['data']
			 //    	for(var j = 0; j < commentsData.length; j++){
				// 		textString = commentsData[j].message;
				// 		id = commentsData[j].id;
				// 		(function(localId,localText){
				// 			sentiment(localText, function (err, result) {
				// 				db.collection("fb_post").find({id: localId}).toArray(function(err, docs){
				// 					if(docs.length === 0) {
				// 						newPost = {id: localId, text: localText};
				// 						db.collection("fb_post").insertOne(newPost);
										
				// 						var set = 'NEUTRAL'
				// 						if(result.score > 0){
				// 							fpos++;
				// 							ftotal++;
				// 							set = 'POSITIVE'
				// 						}

				// 						if(result.score < 0){
				// 							fneg++;
				// 							ftotal++;
				// 							set = 'NEGATIVE'
				// 						}
				// 						score = {pos: (fpos/ftotal)*100, neg: (fneg/ftotal)*100};
				// 						fbpost = {link: 'https://facebook.com/' + localId, message: localText, set: result.score, score: score};
				// 						io.sockets.emit('fb', fbpost);
				// 					}
				// 				});
				// 			});
				// 		})(id,textString);
				// 	}
				// }
			}
		});
	}, 20000);
});

// io.on('disconnect', function(error) {
//     io.disconnect();
// });

// io.on('error', function(error) {
//     io.close();
// });

app.get('/cb', function(req, res, next){
	console.log('get /cb', req.query);
	if (req.query['hub.verify_token'] === 'moi')
		res.send(req.query['hub.challenge']);
	next();
});

app.post('/cb', function(req, res, next){
	console.log('post /cb', req.body);
	next();
});

app.get('/', function(req, res){
	res.sendFile(__dirname + '/index.html');
});

MongoClient.connect('mongodb://localhost/senti', function(err, dbConnection){
	db = dbConnection;
	var s = server.listen(3000, function () {
		var port = server.address().port;
		console.log("Started server at port", port);
	});
});