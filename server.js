const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const jwt = require('jsonwebtoken');

const environment = process.env.NODE_ENV || 'development';
const config = require('./knexfile')[environment];
const database = require('knex')(config);

const app = express();

const requireHTTPS = (request, response, next) => {
  if (request.headers['x-forwarded-proto'] !== 'https') {
    return response.redirect('https://' + request.get('host') + request.url);
  }
  next();
};

if (process.env.NODE_ENV === 'production') {
  app.use(requireHTTPS);
}

app.set('port', process.env.PORT || 3000);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.locals.title = 'UFO-TRACKER';

app.listen(app.get('port'), () => {
  console.log(`${app.locals.title} is running on ${app.get('port')}.`);
});


app.get('/api/v1/shapes/', (request, response) => {
  return database('shapes').select()
    .then(shapes => {
      return response.status(200).json({shapes});
    })
    .catch(error => {
      return response.status(500).json({error: 'Error getting shapes.'});
    });
});

app.get('/api/v1/locations/', (request, response) => {
  return database('locations').select()
    .then(locations => {
      return response.status(200).json({locations});
    })
    .catch(error => {
      return response.status(500).json({error: 'Error getting locations.'});
    });
});


app.get('/api/v1/sightings', async (request, response) => {
  const {city, state} = request.query;

  const locationID = await getLocationID(city, state, response);

  return database('sightings').where('location_id', locationID).select()
    .then(locations => {
      if (!locations.length) {
        return response.status(404).json({error: `No sightings found for location: ${city}, ${state}.`});
      }
      return response.status(200).json({locations});
    })
    .catch(error => {
      return response.status(500).json({error: `Error getting sightings for location: ${city}, r${state}. ${error}`});
    });
});

const getLocationID = (city, state, response) => {
  return database('locations').where('city', city).andWhere('state', state).first()
    .then(location => {
      console.log(location.id);
      return location.id;
    })
    .catch(error => {
      return response.status(500).json({error: `Error getting location information for ${city}, ${state}.`});
    });
};

app.post('/api/v1/sightings', (request, response) => {
  const sighting = request.body;

  for (let requiredParameters of ['location_id', 'shape_id', 'duration', 'summary', 'reported_time']) {
    if (!sighting[requiredParameters]) {
      return response.status(422).json({error: `Missing required paramter ${requiredParameters}.`});
    }
  }

  return database('sightings').insert(sighting, 'id')
    .then(id => {
      return response.status(204).json({status: `Successfully added sighting (#${id}).`});
    })
    .catch(error => {
      return response.status(500).json({error: `Error adding sighting: ${error}.`});
    })
});

app.patch('/api/v1/sightings/:id', (request, response) => {
  const { id } = request.params;
  const { summary } = request.body;

  return database('sightings').where('id', id).update('summary', summary)
    .then(updatedSighting => {
      return response.status(200).json({status: `Successfully updated summary of sighting #${id} to "${summary}".`});
    })
    .catch(error => {
      return response.status(500).json({error: `Error updating sighting. ${error}`});
    })
});

app.delete('/api/v1/sightings', async (request, response) => {
  const {city, state} = request.query;
  const locationID = await getLocationID(city, state, response);

  return database('sightings').where('location_id', locationID).del()
    .then(() => {
      response.status(200).json({status: `Successfully deleted all locations with id #${locationID}.`});
    })
    .catch(error => {
      return response.status(500).json({error: `Error deleting sightings with location id #${locationID}.`});
    });
});

app.post('/authenticate', (request, response) => {
  const { email, appName } = request.body;
  const generatedJWT = jwt.sign({
    expiresIn: '48h',
    data: {email, appName}
  }, app.get('secretKey'));

});


/*
4 GETS
 -2 for all
  - shapes /api/v1/shapes/ √
  - locations /api/v1/locations/ √
 -2 for specific
  - specific shape(id) /api/v1/sightings?shape=TRAINGULAR J
  - specific location(id) /api/v1/sightings?city=Denver&?state=CO T √
 -2 POST - (SECURE)
  - post a new sighting /api/v1/sightings/ T  √
  - post a new location /api/v1/locations/ J
 -2 PUT OR PATCH - (SECURE)
  - update a summary /api/v1/sightings/:id/ T √
  - update the duration /api/v1/sightings/:id/ J
 -2 DELETE - (SECURE)
  - delete a sighting /api/v1/sightings/:id/ J
  - delete all by location or shape /api/v1/sightings?city=Denver&?state=CO T √
*/

module.exports = app;
