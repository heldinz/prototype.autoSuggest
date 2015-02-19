 /*
 * Prototype AutoSuggest
 * Copyright 2009-2010, 2012, 2015 Drew Wilson, Alice Rose
 * heldinz@posteo.de
 * https://github.com/heldinz/prototype.autoSuggest
 *
 * Version 1.0  -  2012-06-22
 * Version 1.1  -  2015-02-19
 *
 * Port of the jQuery AutoSuggest plugin by Drew Wilson,
 * licensed under the MIT license:
 *   https://github.com/drewwilson/AutoSuggest
 *
 * This plugin is licensed under the MIT License:
 *   http://www.opensource.org/licenses/mit-license.php
 */

(function(){
	autoSuggest = function(element, data, options) {
		var defaults = {
			startText: "Enter Name Here",
			emptyText: "No Results Found",
			preFill: {},
			limitText: "No More Selections Are Allowed",
			selectedItemProp: "value",
			selectedValuesProp: "value", //name of object property
			searchObjProps: "value", //comma separated list of object property names
			queryParam: "q",
			retrieveLimit: false, //number for 'limit' param on ajax request
			extraParams: "",
			matchCase: false,
			minChars: 1,
			keyDelay: 400,
			resultsHighlight: true,
			neverSubmit: false,
			selectionLimit: false,
			showResultList: true,
		  	start: function(){},
		  	selectionClick: function(elem){},
		  	selectionAdded: function(elem){},
		  	selectionRemoved: function(elem){ elem.remove(); },
		  	formatList: false, //callback function
		  	beforeRetrieve: function(string){ return string; },
		  	retrieveComplete: function(data){ return data; },
		  	resultClick: function(data){},
		  	resultsComplete: function(){}
	  	};
	 	var opts = Object.extend(defaults, options);

		var d_type = "object";
		var d_count = 0;
		if(typeof data == "string") {
			d_type = "string";
			var req_string = data;
		} else {
			var org_data = data;
			for (k in data) if (data.hasOwnProperty(k)) d_count++;
		}

        function add_selected_item(data, num){
            // Append the chosen property of the data (default: data.value) to the value of values_input
            values_input.setValue($F(values_input)+data[opts.selectedValuesProp]+",");
            // Create an <li> for the new selection, using the given "num" as part of the id
            var item = new Element('li', {'class':"as-selection-item", 'id':"as-selection-"+num}).observe("click", function(){
                // On click:
                // Call optional callback
                opts.selectionClick.call(element, $(this));
                // Remove "selected" class from all other selection <li>s but this one
                selections_holder.childElements().each(function(s){s.removeClassName("selected")});
                $(this).addClassName("selected");
            }).observe("mousedown",function(){ input_focus = false; }); // On mousedown, set input_focus to false
            // Create a close button
            var close = new Element('a', {'class':"as-close"}).update('&times;').observe("click",function(){
                // On click:
                // Remove value from values_input value
                values_input.setValue($F(values_input).replace(","+data[opts.selectedValuesProp]+",",","));
                // Remove selection <li>
                opts.selectionRemoved.call(element, item);
                // Set focus back to the input
                input_focus = true;
                input.focus();
                return false; // Instead of returning the element, because it no longer exists
            });
            // Prepend the close button to the new <li> and insert the new <li> ahead of the original (input) <li>
            org_li.insert({"before":item.update(data[opts.selectedItemProp]).insert({"top":close})});
            // Call optional callback
            opts.selectionAdded.call(element, org_li.previous());
        }

		if((d_type == "object" && d_count > 0) || d_type == "string"){
            var elementId = $(element).identify(),
                input = $(element),
                input_focus = false;
            opts.start.call(element);
            input.writeAttribute("autocomplete","off").addClassName("as-input").setValue(opts.startText);

            // Setup basic elements and render them to the DOM
            input.wrap(new Element('li', {'class':"as-original", 'id':"as-original-"+elementId})).wrap(new Element('ul', {'class':"as-selections", 'id':"as-selections-"+elementId}));
            var selections_holder = $("as-selections-"+elementId);
            var org_li = $("as-original-"+elementId);
            var results_holder = new Element('div', {'class':"as-results", 'id':"as-results-"+elementId}).hide();
            var results_ul =  new Element('ul', {'class':"as-list"});
            var values_input = new Element('input', {'type':"hidden", 'class':"as-values", 'name':"as_values_"+elementId, 'id':"as-values-"+elementId});
            // Insert the values input, which stores the actual values in its value attribute, after the original input field
            input.insert({"after":values_input});
            var prefill_value = "";
            if(typeof opts.preFill == "string"){
                var vals = opts.preFill.split(",");
                for(var i=0; i < vals.length; i++){
                    var v_data = {};
                    v_data[opts.selectedValuesProp] = vals[i].trim();
                    if(vals[i] != ""){
                        add_selected_item(v_data, "000"+i);
                    }
                }
                opts.preFill.split(",").each(function(s){
                    prefill_value += s.trim() + ",";
                });
            } else {
                prefill_value = "";
                var prefill_count = 0;
                for (k in opts.preFill) if (opts.preFill.hasOwnProperty(k)) prefill_count++;
                if(prefill_count > 0){
                    for(var i=0; i < prefill_count; i++){
                        var new_v = opts.preFill[i][opts.selectedValuesProp];
                        if(new_v == undefined){ new_v = ""; }
                        prefill_value = prefill_value+new_v+",";
                        if(new_v != ""){
                            add_selected_item(opts.preFill[i], "000"+i);
                        }
                    }
                }
            }
            if(prefill_value != ""){
                input.setValue("");
                var lastChar = prefill_value.substring(prefill_value.length-1);
                if(lastChar != ","){ prefill_value = prefill_value+","; }
                values_input.setValue(","+prefill_value);
                selections_holder.select("li.as-selection-item").each(function(s){s.addClassName("blur").removeClassName("selected")}); // Display existing tags as unfocused
            }
            // When the input field is clicked, give it focus.
            // When a key is pressed within the input field, set the input_focus var back to false
            // Insert the results (dropdown) list after the selections list
            selections_holder.observe("click",function(){
                input_focus = true;
                input.focus();
            }).observe("mousedown",function(){ input_focus = false; }).insert({"after":results_holder});

            var timeout = null;
            var prev = "";
            var comma_press = false;

            // Handle input field events
            input.observe("focus",function(){
                // When the input field gets focus, check whether we are displaying the starting text and if the real values are empty
                // If so, clear the starting text.
                if($F(this) == opts.startText && $F(values_input) == ""){
                    $(this).setValue("");
                } else if(input_focus){
                    // Otherwise, if we've been clicked in, stop displaying our selections as unfocused
                    selections_holder.select("li.as-selection-item").each(function(s){s.removeClassName("blur")});
                    // If the user has started entering text, display the results dropdown
                    if($F(this) != ""){
                        results_ul.setStyle("width",selections_holder.getWidth());
                        results_holder.show();
                    }
                }
                // Set the input_focus var to true
                input_focus = true;
                return true;
            }).observe("blur",function(){
                // When we lose focus, revert any of the changes we made when we got focus
                if($F(this) == "" && $F(values_input) == "" && prefill_value == ""){
                    $(this).setValue(opts.startText);
                } else if(input_focus){
                    selections_holder.select("li.as-selection-item").each(function(s){s.addClassName("blur").removeClassName("selected")});
                    results_holder.hide();
                }
            }).observe("keydown",function(e) {
            	function addKeywordAsEntered(that) {
                    comma_press = true;
                    // If it was a comma, remove it from our entered text
                    var i_input = $F(input).replace(/(,)/g, "");
                    // If the entered value is not already in our list of selected items and meets our minChars restriction
                    // (Check for leading as well as trailing delimiter, to ensure we don't match just the end of the first element)
                    if(i_input != "" && $F(values_input).search(","+i_input+",") < 0 && i_input.length >= opts.minChars){
                        // Create a new <li> containing the entered text only (active suggestion ignored) and add it to our selected items
                        e.preventDefault();
                        var n_data = {};
                        n_data[opts.selectedItemProp] = i_input;
                        n_data[opts.selectedValuesProp] = i_input;
                        var lis = selections_holder.select("li").length;
                        add_selected_item(n_data, "00"+(lis+1)); // This should also take care of updating the actual value attribute
                        that.setValue(""); // Resets the entered text to an empty string
                        results_holder.hide();
                    }
            	}

                // track last key pressed
                lastKeyPressCode = e.keyCode;
                switch(e.keyCode) {
                    case 38: // up
                        e.preventDefault();
                        moveSelection("up");
                        break;
                    case 40: // down
                        e.preventDefault();
                        moveSelection("down");
                        break;
                    case 8:  // backspace
                        if($F(input) == ""){
                            // If we're not currently entering a new term, then we want to delete the last of our previously-selected terms
                            var last = $F(values_input).split(",");
                            // Not last[last.length - 1], because we have leading and trailing commas in our val, giving us empty strings at indices 0 and -1
                            last = last[last.length - 2];
                            // Ensure that all the <li>s in our list except the one just before the input box -- the last one -- do not have the "selected" class
                            selections_holder.childElements().each(function(s){
                                if (s != org_li.previous()) {
                                    s.removeClassName("selected");
                                }
                            });
                            if (org_li.previous() != undefined) {
                                if(org_li.previous().hasClassName("selected")){
                                    // If the last <li> does have the "selected" class, then delete its value from the value attr of the values_input
                                    values_input.setValue($F(values_input).replace(","+last+",",","));
                                    // Call the selectionRemoved callback to delete the corresponding <li>
                                    opts.selectionRemoved.call(this, org_li.previous());
                                } else {
                                    // Otherwise, don't delete the last item immediately, just select it (i.e. the delete button must be pressed twice to actually delete the item)
                                    opts.selectionClick.call(this, org_li.previous());
                                    org_li.previous().addClassName("selected");
                                }
                            }
                        }
                        // Otherwise, if we have just one character left entered, then we hide the results list again
                        if($F(input).length == 1){
                            results_holder.hide();
                            // Set the prev var to an empty string (previous text entered in the box)
                            prev = "";
                        }
                        // If at this stage we still have at least one visible result, we reset our timeout for the keyChange() function to opts.keyDelay
                        if(results_holder.select(":visible").length > 0){
                            if (timeout){ clearTimeout(timeout); }
                            timeout = setTimeout(function(){ keyChange(); }, opts.keyDelay);
                        }
                        break;
                    case 188:  // comma
                        addKeywordAsEntered($(this));
                        break;
                    case 9: case 13: // tab or return
                        comma_press = false;
                        // If there's no text entered and tab was pressed,
                        // do default behaviour (move to next input)
                        if ($F(this) === ("") && e.keyCode === 13) {
                            break;
                        }
                        // Otherwise, if there is text entered
                        if ($F(this) !== ("")) {
                            // Grab the active suggestion from the list
                            var active = results_holder.select("li.active");
                            if (active.length > 0){
                                // Invoke the click event on it
                                active.each(function(s){s.simulate("click");});
                                $(this).setValue("");
                            } else {
                                // Add the keyword just as the user entered it
                                addKeywordAsEntered($(this));
                            }
                            e.preventDefault();
                        }
                        // hide the results dropdown
                        results_holder.hide();
                        // Prevent the form from being submitted or jumping to next input
                        if(opts.neverSubmit){
                            e.preventDefault();
                        }
                        break;
                    default:
                        // If it's any other key
                        if(opts.showResultList){
                            // If the limit on number of selected items has been hit, just keep displaying the appropriate message
                            if(opts.selectionLimit && $("li.as-selection-item", selections_holder).length >= opts.selectionLimit){
                                results_ul.update('<li class="as-message">'+opts.limitText+'</li>');
                                results_holder.show();
                            } else {
                                // Otherwise treat it as regular text: we reset our timeout for the keyChange() function to opts.keyDelay
                                if (timeout){ clearTimeout(timeout); }
                                timeout = setTimeout(function(){ keyChange(); }, opts.keyDelay);
                            }
                        }
                        break;
                }
            });

            function keyChange() {
                // ignore if the following keys are pressed: [del] [shift] [capslock]
                if( lastKeyPressCode == 46 || (lastKeyPressCode > 8 && lastKeyPressCode < 32) ){ return results_holder.hide(); }
                // Replace all slashes..?
                // String is the current entry in input
                var string = $F(input).replace(/[\\]+|[\/]+/g,"");
                // If the entered text has not changed since last time, do nothing
                if (string == prev) return;
                // Otherwise, update the var prev to be the current entered text
                prev = string;
                if (string.length >= opts.minChars) {
                    selections_holder.addClassName("loading");
                    // If we have a URI for fetching data, use it now
                    if(d_type == "string"){
                        var limit = "";
                        if(opts.retrieveLimit){
                            limit = "&limit="+encodeURIComponent(opts.retrieveLimit);
                        }
                        // We can manipulate the value of string at this point, if we want
                        if(opts.beforeRetrieve){
                            string = opts.beforeRetrieve.call(element, string);
                        }
                        new Ajax.Request(req_string+"?"+opts.queryParam+"="+encodeURIComponent(string)+limit+opts.extraParams, {
                            method: 'get',
                            requestHeaders: {Accept: 'application/json'},
                            onSuccess: function(transport){
                                var data = transport.responseText.evalJSON(true),
                                    new_data = opts.retrieveComplete.call(element, data);
                                d_count = 0;
                                for (k in new_data) if (new_data.hasOwnProperty(k)) d_count++;
                                // Time for munging
                                processData(new_data, string);
                            }
                        });
                    } else {
                        // We already have our JSON object of values
                        // We can manipulate the value of string at this point, if we want
                        if(opts.beforeRetrieve){
                            string = opts.beforeRetrieve.call(element, string);
                        }
                        // Time for munging
                        processData(org_data, string);
                    }
                } else {
                    // We don't have enough chars entered to display the suggestions
                    selections_holder.removeClassName("loading");
                    results_holder.hide();
                }
            }

            function processData(data, query){
                // data = suggestions
                // query = text entered
                if (!opts.matchCase){ query = query.toLowerCase(); }
                var num_count = 0;
                var matchCount = 0;
                // Reset and hide the currently shown suggestions
                results_holder.update(results_ul.update("")).hide();
                for(var num = 0;num<d_count;num++){
                    //var num = i; // First set to 0, goes up to 9
                    num_count++; // First set to 1, goes up to 10
                    var forward = false; // Assume that this data item is not a valid match
                    if(opts.searchObjProps == "value") {
                        var str = data[num].value;                                   // e.g. var str = data[0].value = foo
                    } else {
                        var str = "";
                        var names = opts.searchObjProps.split(",");
                        for(var y=0;y<names.length;y++){
                            var name = names[y].trim();
                            str = str+data[num][name]+" ";
                        }
                    }
                    // Set str to the right string for this element in the data list
                    if(str){
                        if (!opts.matchCase){ str = str.toLowerCase(); }
                        if(str.search(query) != -1 && $F(values_input).search(","+data[num][opts.selectedValuesProp].trim()+",") == -1){
                            // If the entered text is a substring of this data item, and the data item is not already selected, we can proceeed
                            forward = true;
                        }
                    }
                    if(forward){
                        // Create an <li> for the results list and bind some event handlers to it
                        var formatted = new Element('li', {'class':"as-result-item", 'id':"as-result-item-"+num}).observe("click",function(){
                            // On click:
                            var raw_data = $(this).getData("data"); // Retrieve the data from this <li>
                            var number = raw_data.num           // Retrieve its number
                            // If there's no item with this number already selected and we didn't end the tag entry with a comma
                            if(selections_holder.select("#as-selection-"+number).length <= 0 && !comma_press){
                                var data = raw_data.attributes; // Retrieve the attributes for this <li>
                                input.setValue("").focus();     // Reset the input box's value and focus it
                                prev = "";                      // Reset the "prev" var
                                add_selected_item(data, number); // Add this item to the list of selections
                                opts.resultClick.call(this, raw_data); // Optional callback
                                results_holder.hide();           // Hide the suggestions
                            }
                            comma_press = false;					// Reset comma_press to false
                        }).observe("mousedown",function(){
                            // On mousedown, set input_focus to false (the input box should no longer have focus)
                            input_focus = false;
                        }).observe("mouseover",function(){
                            // On mouseover, only this <li> should be marked as active
                            results_ul.select("li").each(function(s){s.removeClassName("active");});
                            $(this).addClassName("active");
                        }).setData("data",{'attributes': data[num], 'num': num_count}); // Set the data attributes that we refer to above e.g. {'attributes': {value: "Foo"}, 'num': 1}

                        var this_data = Object.extend({},data[num]);
                        if (!opts.matchCase){
                            var regx = new RegExp("(?![^&;]+;)(?!<[^<>]*)(" + query + ")(?![^<>]*>)(?![^&;]+;)", "gi");
                        } else {
                            var regx = new RegExp("(?![^&;]+;)(?!<[^<>]*)(" + query + ")(?![^<>]*>)(?![^&;]+;)", "g");
                        }

                        // Highlight the matching substring in this result
                        if(opts.resultsHighlight){
                            this_data[opts.selectedItemProp] = this_data[opts.selectedItemProp].replace(regx,"<em>$1</em>");
                        }
                        // Do the formatting ourselves
                        if(!opts.formatList){
                            formatted = formatted.update(this_data[opts.selectedItemProp]);
                        } else {
                            // User-defined formatting
                            formatted = opts.formatList.call(this, this_data, formatted);
                        }
                        // Insert the <li> to the end of the results list
                        results_ul.insert({"bottom":formatted});
                        // This doesn't work, seems pointless anyway
                        //delete this_data;
                        this_data = {};
                        // Keep track of the number of matching results we have
                        matchCount++;
                        // If we've hit a pre-defined limit, quit iterating through the results now
                        if(opts.retrieveLimit && opts.retrieveLimit == matchCount ){ break; }
                    }
                }
                // Finished iterating through the results
                selections_holder.removeClassName("loading");
                // No matches
                if(matchCount <= 0){
                    results_ul.update('<li class="as-message">'+opts.emptyText+'</li>');
                }
                // Display all suggestions
                results_ul.setStyle({"width":selections_holder.getWidth()});
                results_holder.show();
                // Optional callback
                opts.resultsComplete.call(element);
            }

            function moveSelection(direction){
                // Only do something if there are suggestions displayed
                if(results_holder.select(":visible").length > 0){
                    // All the suggestions
                    var lis = results_holder.select("li");
                    if(direction == "down"){
                        // The first <li>
                        var start = lis[0];
                    } else {
                        // The last <li>
                        var start = lis[lis.length-1];
                    }
                    // The currently active <li>
                    var active = results_holder.select("li.active");
                    if(active.length > 0){
                        // If there's an active <li>
                        active = active[0];
                        if(direction == "down"){
                            // Go to the <li> following
                            var next = active.next();
                            if (next != undefined) {
                                start = next;
                            } else {
                                start = lis[lis.length-1]; // Can't go down anymore, last element
                            }
                        } else {
                            // Go to the <li> previous
                            var previous = active.previous();
                            if (previous != undefined) {
                                start = previous;
                            } else {
                                start = lis[0]; // Can't go up anymore, first element
                            }
                        }
                    }
                    // Set the "active" class to the newly active selection only
                    lis.each(function(s){s.removeClassName("active")});
                    start.addClassName("active");
                }
            }
        }
        return element;
    };

    Element.addMethods({
        /**
         * Element#saveData(@element, key, value) -> @element
         * Caches given data
         * $('foo).setData('keyName', 'Some random data');
         *
         */
        setData: function(element, key, value){
            if (Object.isUndefined(element['ATMCCache']) || !Object.isHash(element['ATMCCache'])){
                element['ATMCCache'] = $H();
            }
            element['ATMCCache'].set(key,value);
            return element;
        },
        /**
         * Element#getData(@element, key) -> Value or Hash
         * Returns requested key or entire hash
         * $('foo).getData('keyName');
         *
         */
        getData: function(element, key){
            return element['ATMCCache'].get(key) || element['ATMCCache'];
        },
        autoSuggest: autoSuggest
    });
})()
