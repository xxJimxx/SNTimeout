var Jims_session_heartbeat = Class.create();
Jims_session_heartbeat.prototype = Object.extendsObject(AbstractAjaxProcessor, {
	pacemaker:function(){
		var response = {
			'dtHeartbeat':null, 
			'secDigest':10,
			"secHeartbeat":60,
			"secWarningDuration":120, 
			"minSessionTimeout":3,
		};
		
		//the datetime value passed in, send it back
		var hb = this.getParameter('sysparm_heartbeat');
		if (!JSUtil.nil(hb)){
			response.dtHeartbeat = hb;
		}
		
		//use system properties to send override UI Script
		var to = gs.getProperty('glide.ui.session_timeout');
		if (!JSUtil.nil(to)){
			response.minSessionTimeout = to;
		}
		
		var json = new JSON();
		return json.encode(response);
	},
    type: 'Jims_session_heartbeat'
});
