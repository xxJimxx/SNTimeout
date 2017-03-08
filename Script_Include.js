var Jims_session_heartbeat = Class.create();
Jims_session_heartbeat.prototype = Object.extendsObject(AbstractAjaxProcessor, {
	pacemaker:function(){
		var response = {
			'dtHeartbeat':null, 
			'secDigest':10,
			"secHeartbeat":60,
			"secWarningDuration":120, 
			"minSessionTimeout":3,
			"sessionID":"",
			"beat":"" 			
		};

		response.sessionID = gs.getSessionID();
		
                //the datetime value passed in, send it back
		var hb = this.getParameter('sysparm_heartbeat');
		if (!JSUtil.nil(hb)){
			response.dtHeartbeat = hb;
		}
		
		//positioning to perform specific action for keep alive when beat is true
		var beat = this.getParameter('sysparm_beat');
		if (!JSUtil.nil(beat)){
			response.beat = beat;
		}

		//use system properties to send override UI Script
		var to = gs.getProperty('glide.ui.session_timeout');
		if (!JSUtil.nil(to)){
			response.minSessionTimeout = to;
		}
		
		//TESTING
		//Found updateing a record would refresh a session in personal dev space but is not working in corporate environment
		var gr1 = new GlideRecord('sys_user_session');
		if (gr1.get('ID', response.sessionID)){
			response.sessionID += ' : Found';
			gr1.last_accessed = response.dtHeartbeat;
			gr1.update(); //update record to keep session alive
		}
		else {
			response.sessionID += ' : Not Found';
		}
		
		
		var json = new JSON();
		return json.encode(response);
	},
    type: 'Jims_session_heartbeat'
});
