var _ = require('underscore');
var $ = require('jquery');
var React = require('react');
var Router = require('react-router');
var Route = Router.Route;
var RouteHandler = Router.RouteHandler;
var DefaultRoute = Router.DefaultRoute;
var Views = require('./views/views.react.jsx');

var App = React.createClass({
  render () {
    return (
      <div>
        <Views.Navbar/>
        <RouteHandler/>
      </div>
    );
  }
});

var routes = (
  <Route path='/' handler={App}>
    <Route path="about" handler={Views.About}/>
    <Route path="repo/:repoOwner/:repoName" name='repo' handler={Views.Visualize}/>
    <Route path="*" handler={Views.Landing}/>
    <DefaultRoute handler={Views.Landing}/>
  </Route>
);

Router.run(routes, function (Handler) {
  React.render(<Handler/>, document.getElementById('content'));
});
