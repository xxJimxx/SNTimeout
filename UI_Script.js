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
		"minSessionTimeout":3,
		'dialogTitle':' ',
		'loginPage':'login.do'
	};
	// globals in JSON to reduce exposure
	var globals = {
		'now':new Date(),
		'lastClientAction':new Date(),
		'lastHeartbeat':new Date(),
		'nextHeartbeat':new Date(),
		'warnAt':null,
		'expireAt':null,
		'objDialog':null,
		'objTimer':null,
		'originalTitle':''
	};
	
	
	//initialize actions (setup timed loop to main)
	function init(){
		//console.log("doc.url = " + window.parent.document.URL);
		if (window.parent.document.URL.indexOf(settings.loginPage) > -1){
			console.log("login page identified, no timer");
			return;
		}
		
		main();
		globals.objTimer = window.setInterval(main, settings.secDigest * 1000);
		heartbeat();
	}
	
	/*main is looped on secDigest and checks for:
	Heartbeat should be performed
	Warning dialog opened
	Session Expired	*/
	function main(){
		console.log("Session Timer: main");
		
		globals.now = new Date();
		calcEnds();		

		if (globals.expireAt.getTime() < globals.now.getTime()){
			//check for session expired
			//SN uses a shared session between browser tabs.  Forcing logoff will end this session.
			//window.location = "logout.do";
			console.log('Session Expired!');
			shutdown();
		}
		else if (globals.warnAt.getTime() < globals.now.getTime()){
			//check if modal should be open
			if (globals.objDialog == null){
				//if modal isn't open, open it
				globals.originalTitle = window.parent.document.title;
				//Set the dialog title
				//Instantiate the dialog
				globals.objDialog = new GlideDialogWindow("Jims_session_warning_modal");
				globals.objDialog.setTitle(settings.dialogTitle);
				globals.objDialog.removeCloseDecoration();
				globals.objDialog.setPreference("expireAt", globals.expireAt);
				globals.objDialog.setPreference("duration", settings.secWarningDuration);
				globals.objDialog.setSize('400','135');
				globals.objDialog.render(); //Open the dialog
			}
		}
		else if (globals.lastClientAction.getTime() > globals.lastHeartbeat.getTime() && globals.now.getTime() >= globals.nextHeartbeat.getTime()){
			//if browser inputs are current and heartbeat duration elapsed, perform heartbeat
			heartbeat();
		}
		else{
			//user has become idle, do nothing
			//console.log('User Inactive');
		}
	}
	
	// Performs a low impact glideAjax call to keep the server session alive while the user is active in the browser
	function heartbeat(){
		var sendDT = new Date();
		var ga = new GlideAjax('Jims_session_heartbeat');
		ga.addParam("sysparm_name", "pacemaker");
		ga.addParam("sysparm_heartbeat",new Date());
		//console.log("Session Timer: heartbeat");
		ga.getXML(onAjaxReturn);
		
	}
	// glideAjax respose
	function onAjaxReturn(xml){
		var response = xml.responseXML.documentElement.getAttribute("answer");
		response = JSON.parse(response);
		
		globals.lastHeartbeat = new Date(response.dtHeartbeat);
		globals.nextHeartbeat = new Date(globals.lastHeartbeat.getTime() + (settings.secHeartbeat * 1000));
		
		//Override client defined interval if response provides different values (Allows for system properties to setup script)
		if (response.minSessionTimeout != null && response.minSessionTimeout != settings.minSessionTimeout){
			settings.minSessionTimeout = response.minSessionTimeout;
			calcEnds();		
		}
		if (response.secWarningDuration != null && response.secWarningDuration != settings.secWarningDuration){
			settings.secWarningDuration = response.secWarningDuration;
			calcEnds();		
		}
		if (response.secHeartbeat != null && response.secHeartbeat != settings.secHeartbeat){
			settings.secHeartbeat = response.secHeartbeat;
		}
		if (response.secDigest != null && response.secDigest != settings.secDigest){
			settings.secDigest = response.secDigest;
			clearInterval(globals.objTimer);
			globals.objTimer = window.setInterval(main, settings.secDigest * 1000);
		}
		
		var echo = {'heartbeatResponse':response, 'settings': settings, 'globals': globals};
		console.log('SessionTimer = ' + JSON.stringify(echo,null,4));
		
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
		console.log("Session Timer: clientAction");
		globals.lastClientAction = new Date();
		if (globals.expireAt != null && globals.expireAt.getTime() < globals.lastClientAction.getTime()){
			//expired, shut it down
			shutdown();
		}
		else if (globals.objDialog != null){
			//if warning dialog is open, close it and refresh session
			window.parent.document.title = globals.originalTitle;
			clearInterval(_GlobalModalInterval);
			globals.objDialog.destroy();
			globals.objDialog = null;
			heartbeat();
		}
	}
	
	//monitor browser input events to to indicate user is active
	window.onmousemove = clientAction;
	window.onclick = clientAction;
	window.onkeypress = clientAction;
	
}());
