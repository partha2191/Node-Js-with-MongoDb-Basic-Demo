const express = require("express");
const http = require("http");
const MongoClient = require("mongodb").MongoClient;
const ObjectID = require("mongodb").ObjectID;
const {config} = require('dotenv');

config();

const app = express();
const server = http.createServer(app);

const port = process.env.PORT;
const connectionString = process.env.LOCAL_URL;

server.listen(port, () => {
    console.log('Server is litsening on port 3000');
});

// Mongodb Connection
MongoClient.connect(connectionString, { useUnifiedTopology: true }, (err, client) => {
    if (err) return console.error(err);
    console.log('Connected to Database');
    const db = client.db('mongotest');
    const users = db.collection("users");
    const movies = db.collection("movies");
    const watchedMovies = db.collection("watched_movies");

    // Middleware
    app.use(express.json({limit: '500mb'}));

    // API routes

    // Fetch User
    app.get('/api/user/list', (req, res) => {
        users.find().toArray()
        .then(result => {
            res.status(200).json(result);
          })
        .catch(error => {
            res.send(error);
        })
    });

    // Fetch Movies
    app.get('/api/movie/list', (req, res) => {
        movies.find().toArray()
        .then(result => {
            res.status(200).json(result);
          })
        .catch(error => {
            res.send(error);
        })
    });

    // Fetch user watched movies
    app.get('/api/user/movies/list', (req, res) => {
        watchedMovies.find().toArray()
        .then(result => {
            res.status(200).json(result);
          })
        .catch(error => {
            res.send(error);
        })
    });

    // * We can also use "upsert" here for better performences
    // Create User
    app.post('/api/user/insert', (req, res) => {
        const payload = req.body;
        users.insertOne(payload)
        .then(result => {
            res.status(200).json(result);
          })
        .catch(error => {
            res.send(error);
        })
    });

    // Create Movie
    app.post('/api/movie/insert', (req, res) => {
        const payload = req.body;
        movies.insertOne(payload)
        .then(result => {
            res.status(200).json(result);
          })
        .catch(error => {
            res.send(error);
        })
    });

    // User Watched movies
    app.put('/api/user/watch/movie', async (req, res) => {
        const payload = req.body;
        let userId = new ObjectID(payload.userId);
        let movieId = new ObjectID(payload.movieId);

        let userDetails = await users.find({ "_id": userId}).toArray();
        if(userDetails.length == 0) return res.status(200).json("No user exsist");

        let movieDetails = await movies.find({ "_id": movieId}).toArray();
        if(movieDetails.length == 0) return res.status(200).json("No movie exsist");
        
        if(userDetails.length == 1 && movieDetails.length == 1){
            // Insert or update a document in watched_movie collection
            const dataObj = {
                userId: userId,
                movieId: movieId,
                name: movieDetails[0].name,
                description: movieDetails[0].description,
                imdb_rating: movieDetails[0].imdb_rating,
                release_year: movieDetails[0].release_year,
                date: new Date()
            };
            const result = await watchedMovies.updateOne({"userId": userId, "movieId": movieId}, {$set: dataObj}, {upsert: true});

            if(result.modifiedCount == 1 || result.upsertedCount == 1){
                // Update the matched document in user collection
                let results = await watchedMovies.find({"userId": userId}).project({_id: 0, name: 1, release_year: 1, imdb_rating: 1}).sort({ date: -1 }).limit(1).toArray();

                let response = await users.updateOne({"_id": userId}, { $set: {"latest_watched_movies": results} });

                if(response.modifiedCount == 1){
                    res.status(200).json("success");
                } else {
                    res.status(200).json("something went wrong");
                }
            } else {
                res.status(200).json("something went wrong");
            }
        } else {
            res.status(200).json("something went wrong");
        }
        
    });

    // Delete watched movie by user
    app.delete('/api/user/movie/delete', async (req, res) => {
        let payload = req.body;
        let userId = new ObjectID(payload.userId);
        let watchMovieId = new ObjectID(payload.watchMovieId);

        let userDetails = await users.find({ "_id": userId}).toArray();
        if(userDetails.length == 0) return res.status(200).json("No user exsist");

        if(userDetails.length == 1){
            // Check the given watch movie id exist or not
            let watchedMoviesDetails = await watchedMovies.find({ "_id": watchMovieId, "userId": userId }).toArray();
            if(watchedMoviesDetails.length == 0) return res.status(200).json("Nothing found or given user does not watched this movie");
            let a = {};
            let deleteDocument = await watchedMovies.deleteOne({_id: watchMovieId});
            if(deleteDocument.result.n == 1) {
                let results = await watchedMovies.find({"userId": userId}).project({_id: 0, name: 1, release_year: 1, imdb_rating: 1}).sort({ date: -1 }).limit(1).toArray();

                let response = await users.updateOne({"_id": userId}, { $set: {"latest_watched_movies": results} });

                if(response.modifiedCount == 1){
                    res.status(200).json("one document deleted successfully");
                } else {
                    res.status(200).json("something went wrong");
                }
            } else {
                res.status(200).json("something went wrong");
            }
        } else {
            res.status(200).json("something went wrong");
        }
    });

});

