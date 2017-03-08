//the modal variable must be exposed in order to kill the modal timer if activity is resumed durring warning
var _GlobalModalInterval = null;

//use a javascript IIFE to protect window events from being destroyed with GlideDialogWindow destroy
(function () {
	//when page is loaded initialize
	addLoadEvent(init);
	
	/*Settings as JSON object contain values to be configured
	secHeartbeat in seconds configures client activity check with heartbeat if user is active
	secWarningDuration in Seconds configures with how much time remaining should a warning dialog appear
	minSessionTimeout is Minutes configures when to kill the session (I prefer this to be within the margin of error for the server timeout) */
	var settings = {
		'secDigest':10,
		"secHeartbeat":60,
		"secWarningDuration":120,
		"minSessionTimeout":30,
		'dialogTitle':' ',
		'loginPage':'login.do'
		'hbRetries': 2
	};
	var objDialog = null; //do not put in globals to to logging issue
	// globals in JSON to reduce exposure
	var globals = {
		'now':new Date(),
		'lastClientAction':new Date(),
		'lastHeartbeat':new Date(),
		'nextHeartbeat':new Date(),
		'warnAt':null,
		'expireAt':null,
		'objTimer':null,
		'originalTitle':''
	};
	
	
    //initialize actions (setup timed loop to main)
    function init() {
        //console.log("doc.url = " + window.parent.document.URL);
        if ((window.name !== 'gsft_main') || (window.parent.document.URL.indexOf(settings.loginPage) > -1)) {
            console.log("Prevent timer in this window or on this page.");
            return;
        }
		
        globals.objTimer = window.setInterval(main, settings.secDigest * 1000);
        main();
        if ((typeof Notification !== 'undefined') && (Notification.permission !== "granted")) {
            Notification.requestPermission();
        }
    }	
	
	/*main is looped on secDigest and checks for:
	Heartbeat should be performed
	Warning dialog opened
	Session Expired	*/
    function main() {
        //console.log("Session Timer: main");

        globals.now = new Date();
        calcEnds();

        if (globals.expireAt.getTime() < globals.now.getTime()) {
            //check for session expired
            //SN uses a shared session between browser tabs.  Forcing logoff will end this session.
            //window.location = "logout.do";
            console.log('Session Expired!');
            shutdown();
        }
        else if (globals.warnAt.getTime() < globals.now.getTime()) {
            //check if modal should be open on each digest
            if (objDialog == null) {
                //if modal isn't open, open it
                openWarningModal();
                if ((typeof Notification !== 'undefined') && (Notification.permission === "granted")) {
                    notify('    A browser tab is\r\n        about to expire...', 10);
                }
            }
            //heartbeat on digest during modal to check if other tabs are active
            //heartbeat(globals.lastClientAction.getTime() > globals.lastHeartbeat.getTime());
        }
        else if (globals.now.getTime() >= globals.nextHeartbeat.getTime()) {
            //heartbeat duration elapsed, perform heartbeat
            heartbeat(globals.lastClientAction.getTime() > globals.lastHeartbeat.getTime());
        }
        else {
            //digest between heartbeats
            //notify('    Hello\r\n        world...',5);
        }
    }
	
    function openWarningModal() {
        globals.originalTitle = window.parent.document.title;
        //Set the dialog title
        //Instantiate the dialog
        objDialog = new GlideDialogWindow("Jims_session_warning_modal");
        objDialog.setTitle(settings.dialogTitle);
        objDialog.removeCloseDecoration();
        objDialog.setPreference("expireAt", globals.expireAt);
        objDialog.setPreference("duration", settings.secWarningDuration);
        objDialog.setSize('400', '135');
        objDialog.render(); //Open the dialog
    }	
	
    function notify(msg, secDuration) {
        var options = {
            'body': msg,
            'icon': '/favicon.ico'
        };
        var notification = new Notification('Session Timer Notification', options);
        notification.onclick = function () {
            window.focus();
        };
        setTimeout(function () {
            notification.close();
        }, secDuration * 1000);
    }	
	
	// Performs basic glideAjax call to server
    // blnBeat true if Client activity since last heartbeat to refresh session.
    // blnBeat false do not refresh timer but check if other tabs are active
    function heartbeat(blnBeat) {
        var sendDT = new Date();
        var ga = new GlideAjax('Jims_session_heartbeat');
        ga.addParam("sysparm_name", "pacemaker");
        ga.addParam("sysparm_heartbeat", new Date());
        ga.addParam("sysparm_beat", blnBeat);
        //console.log("Session Timer: heartbeat");
        ga.getXML(onAjaxReturn);

    } 
	// glideAjax respose
    function onAjaxReturn(result) {
        var strResponse = result.responseXML.documentElement.getAttribute("answer");
        if (strResponse == null) {
            if (globals.intRetry < settings.hbRetries) {
                globals.intRetry += 1;
                return;
            }
            else {
                shutdown();
                alert('Your session ended prematurely.  Please re-establish your connection to continue.');
                return;
            }
        }

        var response = JSON.parse(strResponse);
        globals.lastHeartbeat = new Date(response.dtHeartbeat);
        globals.nextHeartbeat = new Date(globals.lastHeartbeat.getTime() + (settings.secHeartbeat * 1000));

        //Override client defined interval if response provides different values (Allows for system properties to setup script)
        if (response.minSessionTimeout != null && response.minSessionTimeout != settings.minSessionTimeout) {
            settings.minSessionTimeout = response.minSessionTimeout;
            calcEnds();
        }
        if (response.secWarningDuration != null && response.secWarningDuration != settings.secWarningDuration) {
            settings.secWarningDuration = response.secWarningDuration;
            calcEnds();
        }
        if (response.secHeartbeat != null && response.secHeartbeat != settings.secHeartbeat) {
            settings.secHeartbeat = response.secHeartbeat;
        }
        if (response.secDigest != null && response.secDigest != settings.secDigest) {
            settings.secDigest = response.secDigest;
            clearInterval(globals.objTimer);
            globals.objTimer = window.setInterval(main, settings.secDigest * 1000);
        }
        globals.intRetry = 0;
        var echo = { 'heartbeatResponse': response, 'settings': settings, 'globals': globals };
        console.log('SessionTimer = ' + JSON.stringify(echo, null, 4));

    }
	function calcEnds(){
		globals.expireAt = new Date(globals.lastClientAction.getTime() + (settings.minSessionTimeout * 60000));
		globals.warnAt = new Date(globals.expireAt.getTime() - (settings.secWarningDuration * 1000));
	}
	
	function shutdown(){
		clearInterval(globals.objTimer);
		window.onmousemove = null;
		window.onclick = null;
		window.onkeypress = null;
		
	}
	
	//refresh last user input datetime, if dialog is open when user becomes active close dialog and perform heartbeat
	function clientAction(){
		//console.log("Session Timer: clientAction");
		globals.lastClientAction = new Date();
		if (globals.expireAt != null && globals.expireAt.getTime() < globals.lastClientAction.getTime()){
			//expired, shut it down
			shutdown();
		}
		else if (objDialog != null){
			//if warning dialog is open, close it and refresh session
			window.parent.document.title = globals.originalTitle;
			clearInterval(_GlobalModalInterval);
			objDialog.destroy();
			objDialog = null;
			heartbeat(true);
		}
	}
	
	//monitor browser input events to to indicate user is active
	window.onmousemove = clientAction;
	window.onclick = clientAction;
	window.onkeypress = clientAction;
	
}());
