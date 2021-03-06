(function(angular) {
    'use strict';

    function MirrorCtrl(
            AnnyangService,
            GeolocationService,
            WeatherService,
            FitbitService,
            MapService,
            HueService,
            CalendarService,
            ComicService,
            GiphyService,
            TrafficService,
            TimerService,
            $rootScope, $scope, $timeout, $interval, tmhDynamicLocale, $translate) {
        var _this = this;
        $scope.listening = false;
        $scope.debug = false;
        $scope.focus = "default";
        $scope.user = {};
        $scope.commands = [];
        /*$translate('home.commands').then(function (translation) {
            $scope.interimResult = translation;
        });*/
        $scope.interimResult = $translate.instant('home.commands');
        $scope.layoutName = 'main';

        $scope.fitbitEnabled = false;
        if (typeof config.fitbit != 'undefined') {
            $scope.fitbitEnabled = true;
        }

        //set lang
        $scope.locale = config.language;
        tmhDynamicLocale.set(config.language.toLowerCase());
        moment.locale(config.language);
        console.log('moment local', moment.locale());
        
        //Update the time
        function updateTime(){
            $scope.date = new moment();
        }

        // Reset the command text
        var restCommand = function(){
            $translate('home.commands').then(function (translation) {
                $scope.interimResult = translation;
            });
        };

        _this.init = function() {
            var tick = $interval(updateTime, 1000);
            updateTime();
            GeolocationService.getLocation({enableHighAccuracy: true}).then(function(geoposition){
                console.log("Geoposition", geoposition);
                $scope.map = MapService.generateMap(geoposition.coords.latitude+','+geoposition.coords.longitude);
            });
            restCommand();

            var refreshMirrorData = function() {
                //Get our location and then get the weather for our location
                GeolocationService.getLocation({enableHighAccuracy: true}).then(function(geoposition){
                    console.log("Geoposition", geoposition);
                    WeatherService.init(geoposition).then(function(){
                        $scope.currentForcast = WeatherService.currentForcast();
                        $scope.weeklyForcast = WeatherService.weeklyForcast();
                        $scope.hourlyForcast = WeatherService.hourlyForcast();
                        console.log("Current", $scope.currentForcast);
                        console.log("Weekly", $scope.weeklyForcast);
                        console.log("Hourly", $scope.hourlyForcast);

                        var skycons = new Skycons({"color": "#aaa"});
                        skycons.add("icon_weather_current", $scope.currentForcast.iconAnimation);

                        skycons.play();

                        $scope.iconLoad = function (elementId, iconAnimation){
                            skycons.add(document.getElementById(elementId), iconAnimation);
                            skycons.play();
                        };

                    });


                }, function(error){
                    console.log(error);
                });

                CalendarService.getCalendarEvents().then(function(response) {
                    $scope.calendar = CalendarService.getFutureEvents();
                }, function(error) {
                    console.log(error);
                });

                if ($scope.fitbitEnabled) {
                    setTimeout(function() { refreshFitbitData(); }, 5000);
                }
            };

            var refreshFitbitData = function() {
                console.log('refreshing fitbit data');
                FitbitService.profileSummary(function(response){
                    $scope.fbDailyAverage = response;
                });
                
                FitbitService.todaySummary(function(response){
                    $scope.fbToday = response;
                });
            };

            refreshMirrorData();
            $interval(refreshMirrorData, 1500000);

            var greetingUpdater = function () {
                if(!Array.isArray(config.greeting) && typeof config.greeting.midday != 'undefined') {
                    var hour = moment().hour();
                    var geetingTime = "midday";

                    if (hour > 4 && hour < 11) {
                        geetingTime = "morning";
                    } else if (hour > 18 && hour < 23) {
                        geetingTime = "evening";
                    } else if (hour >= 23 || hour < 4) {
                        geetingTime = "night";
                    }

                    $scope.greeting = config.greeting[geetingTime][Math.floor(Math.random() * config.greeting.morning.length)];
                }else if(Array.isArray(config.greeting)){
                    $scope.greeting = config.greeting[Math.floor(Math.random() * config.greeting.length)];
                }
            };
            greetingUpdater();
            $interval(greetingUpdater, 120000);

            var refreshTrafficData = function() {
                TrafficService.getTravelDuration().then(function(durationTraffic) {
                    console.log("Traffic", durationTraffic);
                    $scope.traffic = {
                        destination: config.traffic.name,
                        duration : durationTraffic
                    };
                }, function(error){
                    $scope.traffic = {error: error};
                });
            };

            refreshTrafficData();
            $interval(refreshTrafficData, config.traffic.reload_interval * 60000);

            var refreshComic = function () {
            	console.log("Refreshing comic");
            	ComicService.initDilbert().then(function(data) {
            		console.log("Dilbert comic initialized");
            	}, function(error) {
            		console.log(error);
            	});
            };

            refreshComic();
            var defaultView = function() {
                console.debug("Ok, going to default view...");
                $scope.focus = "default";
            }

            $interval(refreshComic, 12*60*60000); // 12 hours

            var addCommand = function(commandId, commandFunction){
                var voiceId = 'commands.'+commandId+'.voice';
                var textId = 'commands.'+commandId+'.text';
                var descId = 'commands.'+commandId+'.description';
                $translate([voiceId, textId, descId]).then(function (translations) {
                    AnnyangService.addCommand(translations[voiceId], commandFunction);
                    if (translations[textId] != '') {
                        var command = {"text": translations[textId], "description": translations[descId]};
                        $scope.commands.push(command);
                    }
                });
            };

            // List commands
            addCommand('list', function() {
                console.debug("Here is a list of commands...");
                console.log(AnnyangService.commands);
                $scope.focus = "commands";
            });

            
            // Go back to default view
            addCommand('home', defaultView);

            // Hide everything and "sleep"
            addCommand('sleep', function() {
                console.debug("Ok, going to sleep...");
                $scope.focus = "sleep";
            });

            // Go back to default view
            addCommand('wake_up', defaultView);

            // Hide everything and "sleep"
            addCommand('debug', function() {
                console.debug("Boop Boop. Showing debug info...");
                $scope.debug = true;
            });
            
            // Show map
            addCommand('map_show', function() {
                console.debug("Going on an adventure?");
                GeolocationService.getLocation({enableHighAccuracy: true}).then(function(geoposition){
                    console.log("Geoposition", geoposition);
                    $scope.map = MapService.generateMap(geoposition.coords.latitude+','+geoposition.coords.longitude);
                    $scope.focus = "map";
                });
            });
            
            // Hide everything and "sleep"
            addCommand('map_location', function(location) {
                console.debug("Getting map of", location);
                $scope.map = MapService.generateMap(location);
                $scope.focus = "map";
            });

            // Zoom in map
            addCommand('map_zoom_in', function() {
                console.debug("Zoooooooom!!!");
                $scope.map = MapService.zoomIn();
            });

            addCommand('map_zoom_out', function() {
                console.debug("Moooooooooz!!!");
                $scope.map = MapService.zoomOut();
            });

            addCommand('map_zoom_point', function(value) {
                console.debug("Moooop!!!", value);
                $scope.map = MapService.zoomTo(value);
            });

            addCommand('map_zoom_reset', function() {
                console.debug("Zoooommmmmzzz00000!!!");
                $scope.map = MapService.reset();
                $scope.focus = "map";
            });

            // Search images
            addCommand('images_search', function(term) {
                console.debug("Showing", term);
            });

            // Set a reminder
            addCommand('reminder_insert', function(task) {
                console.debug("I'll remind you to", task);
            });

            // Clear reminders
            addCommand('reminder_clear', function() {
                console.debug("Clearing reminders");
            });

            // Check the time
            addCommand('time_show', function(task) {
                 console.debug("It is", moment().format('h:mm:ss a'));
            });

            // Turn lights off
            addCommand('light_action', function(state, action) {
                HueService.performUpdate(state + " " + action);
            });

            //Show giphy image
            addCommand('image_giphy', function(img) {
                GiphyService.init(img).then(function(){
                    $scope.gifimg = GiphyService.giphyImg();
                    $scope.focus = "gif";
                });
            });

            //Show fitbit stats (registered only if fitbit is configured in the main config)
            if ($scope.fitbitEnabled) {
                AnnyangService.addCommand('show my walking', function() {
                    refreshFitbitData();
                });
            }

            // Show xkcd comic
            addCommand('image_comic', function(state, action) {
                console.debug("Fetching a comic for you.");
                ComicService.getXKCD().then(function(data){
                    $scope.xkcd = data.img;
                    $scope.focus = "xkcd";
                });
            });

            // Show Dilbert comic
            addCommand('image_comic_dilbert', function(state, action) {
                console.debug("Fetching a Dilbert comic for you.");
                $scope.dilbert = ComicService.getDilbert("today");  // call it with "random" for random comic
                $scope.focus = "dilbert";
            });

            // Start timer
            addCommand('timer_start', function(duration) {
                console.debug("Starting timer");
                TimerService.start(duration);
                $scope.timer = TimerService;
                $scope.focus = "timer";

                $scope.$watch('timer.countdown', function(countdown){
                    if (countdown === 0) {
                        TimerService.stop();
                        // defaultView();
                    }
                });
            });

            // Show timer
            addCommand('timer_show', function() {
              if (TimerService.running) {
                // Update animation
                if (TimerService.paused) {
                  TimerService.start();
                  TimerService.stop();
                } else {
                  TimerService.start();
                }

                $scope.focus = "timer";
              }
            });

            // Stop timer
            addCommand('timer_stop', function() {
              if (TimerService.running && !TimerService.paused) {
                TimerService.stop();
              }
            });

            // Resume timer
            addCommand('timer_resume', function() {
              if (TimerService.running && TimerService.paused) {
                TimerService.start();
                $scope.focus = "timer";
              }
            });

            var resetCommandTimeout;
            //Track when the Annyang is listening to us
            AnnyangService.start(function(listening){
                $scope.listening = listening;
            }, function(interimResult){
                $scope.interimResult = interimResult;
                $timeout.cancel(resetCommandTimeout);
            }, function(result){
                if(typeof result != 'undefined'){
                    $scope.interimResult = result[0];
                    resetCommandTimeout = $timeout(restCommand, 5000);
                }
            }, function(error){
                console.log(error);
                if(error.error == "network"){
                    $scope.speechError = "Google Speech Recognizer is down :(";
                    AnnyangService.abort();
                }
            });
        };

        _this.init();
    }

    angular.module('SmartMirror')
        .controller('MirrorCtrl', MirrorCtrl);

    function themeController($scope) {
        $scope.layoutName = (typeof config.layout != 'undefined' && config.layout)?config.layout:'main';
    }

    angular.module('SmartMirror')
        .controller('Theme', themeController);

}(window.angular));
