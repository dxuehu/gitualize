var $ = require('jquery');
var React = require('react/addons');
var ReactCSSTransitionGroup = React.addons.CSSTransitionGroup;
var socket = require('socket.io-client')('http://gitualize.com');
var Navigation = require('react-router').Navigation;
var ReactBootstrap = require('react-bootstrap');
var Grid = ReactBootstrap.Grid;
var Row = ReactBootstrap.Row;
var Col = ReactBootstrap.Col;
var Modal = ReactBootstrap.Modal;
var Input = ReactBootstrap.Input;
var ButtonInput = ReactBootstrap.ButtonInput;
var Well = ReactBootstrap.Well;

var Path = require('./path.react.jsx');
var Directory = require('./directory.react.jsx');
var File = require('./file.react.jsx');
var Folder = require('./folder.react.jsx');
var Playbar = require('./playbar.react.jsx');
var CommitInfo = require('./commitInfo.react.jsx');
var Tree = require('../utils/fileTreeUtils');
var Loading = require('./loading.react.jsx');
var Diffualize = require('./diffualize.react.jsx');

var Visualize = React.createClass({
  mixins : [Navigation],
  getCommits: function () {
    //save accesstoken to localStorage for future repo requests
    if (!window.localStorage.gitHubAccessToken && this.props.query.accessToken) {
      window.localStorage.gitHubAccessToken = this.props.query.accessToken;
    }
    //remove accesstoken from url
    window.location.hash = window.location.hash.split('?')[0];

    var repoFullName = this.props.params.repoOwner + '/' + this.props.params.repoName;
    socket.emit('getCommits', {accessToken: window.localStorage.gitHubAccessToken, repoFullName: repoFullName});
    socket.on('gotCommitsError', function(error) { //error scraping w/ spooky, probably b/c repo doesn't exist. (first step in getting commit data)
      return this.transitionTo('/', null, {error: 'badRepo'});
    }.bind(this));
    socket.on('authRequired', function(data) {
      window.location = data.authUrl; //redirect to auth
    });
    var firstCommit = true; //only build tree and paths the first time
    socket.on('gotCommits', function(commitsData) {
      commitsData = JSON.parse(commitsData);
      var commits = commitsData.commits;
      if (!Array.isArray(commits) || commits.length < 1) return this.transitionTo('/', null, {error: 'badRepo'}); //in case of server uncaught err
      commits.forEach(function(commit) {
        commit.files = JSON.parse(commit.files);
      });
      //build tree and flat path stuff before rendering
      if (firstCommit) {
        this.setState({totalNumCommits: commitsData.totalNumCommits});
        Tree.updateTree(commits[0], this.state.fileTree);
        this.updatePaths(0, commits);
        firstCommit = false;
      }
      if (this.isMounted()) {
        this.setState({commits: this.state.commits.concat(commits)});
      }
    }.bind(this));
  },

  updateWindowHeight: function() {
    this.setState({windowHeight: $(window).height() - 305});
  },

  componentWillMount: function() {
    this.getCommits();
  },

  componentDidMount: function() {
    // have app adjust size whenever browser window is resized
    window.addEventListener('resize', this.updateWindowHeight);
  },

  componentWillUnmount : function() {
    // remove window event listener for when the page is changed
    window.removeEventListener('resize', this.updateWindowHeight);
  },

  updatePaths: function (index, commits) {
    var filePaths = this.state.filePaths;
    var files = commits? commits[index].files : this.state.commits[index].files;
    files.forEach(function(file) {
      var path = file.filename;
      filePaths[path] = filePaths[path] || {};
      if (filePaths[path].raw_url) filePaths[path].last_url = filePaths[path].raw_url;
      filePaths[path].raw_url = file.raw_url;
      filePaths[path].commitIndex = this.state.commitIndex; //last updated commitIndex
      var pathArray = path.split('/');
      filePaths[path].isFolder = pathArray[pathArray.length-1] === '';
    }.bind(this));
  },

  updateCommitIndex: function (index) {
    if (index >= this.state.commits.length) {
      return null;
    }
    if (this.state.playbarDirection === 'forward') {
      Tree.updateTree(this.state.commits[index], this.state.fileTree, 'forward');
      this.updatePaths(index);
      this.setState( {commitIndex: index, filePaths: this.state.filePaths, fileTree: this.state.fileTree} );
      return;
    }
    if (index >= 0) {
      Tree.updateTree(this.state.commits[index + 1], this.state.fileTree, 'backward');
    }
    this.updatePaths(index);
    this.setState( {commitIndex: index, filePaths: this.state.filePaths, fileTree: this.state.fileTree} );
  },

  updateCurrentPath: function (path) {
    this.setState({currentPath: path});
  },

  showFileDiffualize: function() {
    this.setState( {showFileDiffualize: true} );
  },

  closeFileDiffualize: function() {
    this.setState( {showFileDiffualize: false} );
  },

  updatePlaybarDirection: function (direction) {
    this.setState({playbarDirection: direction});
  },

  reset: function() {
    var fileTree = {};
    Tree.updateTree(this.state.commits[0], fileTree);
    this.state.filePaths = {};
    this.updatePaths(0);
    this.setState( {commitIndex: 0, currentPath: '', fileTree: fileTree, playbarDirection: 'forward'} );
  },

  getInitialState: function() {
    return {windowHeight: $(window).height() - 305, commits: [], commitIndex: 0, currentPath: '', fileTree: {}, filePaths : {}, playbarDirection: 'forward', showFileDiffualize: false};
  },

  fileOrFolder: function() {
    if (this.state.filePaths[this.state.currentPath] && !this.state.filePaths[this.state.currentPath].isFolder) {
      return (
        <Col xs={9} md={9} style={{height: this.state.windowHeight, minHeight: 200, overflow: 'scroll'}}>
          <pre style={{wordWrap: 'break-word; white-space; pre-wrap',height: this.state.windowHeight, overflow: 'scroll'}}>
            <File urls={{to : '', from: ''}} filePaths={this.state.filePaths} currentPath={this.state.currentPath}/>
          </pre>
        </Col>
      )
    }
    else {
      return (
        <Col xs={9} md={9}>
          <Well bsSize='small' style={{height: this.state.windowHeight, minHeight: 200, overflow: 'scroll'}}>
            <Folder fileTree={this.state.fileTree} currentCommit={this.state.commits[this.state.commitIndex]} currentPath={this.state.currentPath} updateCurrentPath={this.updateCurrentPath}/>
          </Well>
        </Col>
      )
    }
  },

  modalOrNo: function() {
    if (this.state.showFileDiffualize) {
      return (
        <Diffualize commitIndex={this.state.commitIndex} filePaths={this.state.filePaths} currentPath={this.state.currentPath} commits={this.state.commits} windowHeight={this.state.windowHeight}/>
      )
    } else {
      return ;
    }
  },

  render: function () {
    if (this.state.commits.length > 0) {
      var maindisplay = this.fileOrFolder();
      var modal = this.modalOrNo();

      return (
      <ReactCSSTransitionGroup transitionName="visualize" transitionAppear={true}>
        <div>
          <Grid>
            <Row className='show-grid'>
              <Col xs={12} md={12}>
                <Path repoName={this.props.params.repoName} currentPath={this.state.currentPath} updateCurrentPath={this.updateCurrentPath}/>
              </Col>
            </Row>

            <CommitInfo currentCommit={this.state.commits[this.state.commitIndex]}/>

            <Row className='show-grid'>
              <Col xs={3} md={3}>
                <Well bsSize='small' style={{height: this.state.windowHeight, minHeight: 200, overflow: 'scroll'}}>
                  <Directory fileTree={this.state.fileTree} currentCommit={this.state.commits[this.state.commitIndex]} currentPath={this.state.currentPath} updateCurrentPath={this.updateCurrentPath}/>
                </Well>
              </Col>
              {maindisplay}
            </Row>

            <Playbar playbarDirection={this.state.playbarDirection} updatePlaybarDirection={this.updatePlaybarDirection} currentCommit={this.state.commits[this.state.commitIndex]} numberOfCommits={this.state.commits.length-1} commitIndex={this.state.commitIndex} updateCommitIndex={this.updateCommitIndex} totalNumCommits={this.state.totalNumCommits-1} reset={this.reset} showFileDiffualize={this.showFileDiffualize} isFile={this.state.filePaths[this.state.currentPath] && !this.state.filePaths[this.state.currentPath].isFolder}/>
          </Grid>

          <Modal bsSize='large' show={this.state.showFileDiffualize} onHide={this.closeFileDiffualize}>
            <Modal.Header closeButton>
              <Modal.Title>Diffualizing {this.state.currentPath}</Modal.Title>
            </Modal.Header>
            {modal}
          </Modal>
        </div>
      </ReactCSSTransitionGroup>
      )
    } else {
      return (
        <Loading/>
      )
    }
  }
});

module.exports = Visualize;
