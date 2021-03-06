var utils = require('./commitsUtils');
var Promise = require('bluebird');
var getCommits = function(repoFullName, accessToken, socket, res) { //res is optional. kept to still keep api functionality for other devs and such. we are using sockets
  if (accessToken) {
    console.log('get Commits accessToken: ', accessToken);
    utils.setAccessToken(accessToken); //TODO refactor like socket
  }
  utils.getCommitsFromDb(repoFullName)
  .then(function(commitsData) {
    if (commitsData && commitsData.commits && commitsData.commits.length > 0) {
      var commits = commitsData.commits;
      if (res) res.json(commitsData); //commits are in db, send back if someone is using our api endpoint as a nice feature
      socket.emit('gotCommits', JSON.stringify(commitsData)); //stringify just in case--big arr, just sending the arr caused problems jumping to catch below
    }
  }).catch(function(err) {
    console.log('commits not in db, going to github');
    //commits not in db, go to github
    if (!accessToken) { //redirect to /auth with original repo request info
      socket.emit('authRequired', {authUrl: '/auth?repoFullName='+repoFullName});
      if (res) res.json({msg: 'auth required', authUrl: '/auth?repoFullName='+repoFullName});
      return;
    }
    utils.getCommitsFromGithub(repoFullName, 1000, socket)
    .then(function(commitsData) {
      //cannot put socket emitting here unfortunately
      //due to how promise/callback works. callback is only called once
      //(only emits the first time, doesn't seem to work with recursive getMoreCommits in utils)
      //else it would be symmetric with above socket emit but with commits

      //socket emit is in utils
      if (res) res.json(commitsData); //send back first page of commits if someone uses our api
    })
    .catch(function(error) { //repo doesn't exist msg
      console.error(error);
      if (res) res.send(error);
    });
  }).catch(function(err) {
    console.error(err);
    socket.emit('gotCommitsError', err);
    console.log('emitted gotCommitsError');
    if (res) res.send(err);
  });
};

module.exports = function(socket) {
  socket.on('getCommits', function(requestData) {
    getCommits(requestData.repoFullName, requestData.accessToken, socket);
  });
};
