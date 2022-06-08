/**
 * PsychoJS Stimuli Inspector.
 *
 * @author Nikita Agafonov https://github.com/lightest
 * @copyright (c) 2020-2022 Open Science Tools Ltd. (https://opensciencetools.org)
 * @license Distributed under the terms of the MIT License
 * @description A tool for inspecting PsychoJS stimuli. The idea is to have one file tool that is easy to toss around and plug in where needed.
 * Zero dependency, one file, no additional anything required - just works.
 */

export class StimInspector {
	constructor (pjsWin, pjsLib) {
		if (!pjsWin) {
			throw "Need PsychoJS win to work!";
		}
		if (!pjsLib) {
			throw "Need PsychoJS to work!";
		}
		this._pjsLib = pjsLib;
		this._pjsWin = pjsWin;
		this._inspectedStim = undefined;
		this._dom = undefined;
		this._grabbed = false;
		this._init();
	}

	static #FIELDS_WITH_FLOAT_DATA_TYPE = {
		"phase": {
			step: .01
		},
		"contrast": {
			step: .01
		},
		"opacity": {
			step: .01
		},
		"ori": {
			step: .1
		},
		"pos": {
			step: .1
		},
		"size": {
			step: .1
		},
		"volume": {
			step: .1
		}
	};

	static #UNITS = {
		PIX: "pix",
		NORM: "norm",
		HEIGHT: "height"
	};

	static #KEYCODES = {
		ESC: 27
	};

	_getStyles () {
		return `
		:root {
			--rows-margin: 7px;
			--grab-area-height: 32px;
			--filter-area-height: 31px;
			--content-border-color: #6d747d;
		}

		.stim-inspector {
			position: absolute;
			z-index: 99999;
			top: 0;
			left: 0;
			transform: translate3d(0, 0, 0);
			display: flex;
			flex-direction: column;
			font-family: arial;
			box-sizing: border-box;
			min-width: 128px;
			min-height: 256px;
			max-height: 100%;
			resize: auto;
			background: white;
			box-shadow: rgb(0 0 0 / 35%) 0px 0px 20px;
			border: 1px solid #707070;
			overflow: hidden;
		}

		.stim-inspector * {
			box-sizing: border-box;
		}

		.stim-inspector.minimized {
			min-height: var(--grab-area-height);
			max-height: var(--grab-area-height);
			max-width: 128px;
			resize: none;
		}

		.stim-inspector.minimized .filter-area,
		.stim-inspector.minimized .content-area {
			display: none;
		}

		.grab-area {
			display: flex;
			justify-content: space-between;
			height: var(--grab-area-height);
			background: black;
			color: white;
			padding: 8px;
			cursor: default;
		}

		.stim-inspector .grab-area-title {
			text-overflow: ellipsis;
			overflow: hidden;
			white-space: nowrap;
		}

		.grab-area .window-controls-btn {
			padding: 0 3px;
		}

		.grab-area .window-controls-btn:hover {
			background: rgba(255, 255, 255, .3);
		}

		.stim-inspector .content-area {
			display: flex;
			overflow: auto;
			height: 100%;
		}

		.stim-inspector .toolbox {
			padding: 3px;
			border-right: 1px solid var(--content-border-color);
		}

		.stim-inspector .toolbox .btn {
			font-size: 16px;
			font-weight: bold;
			border-radius: 3px;
			width: 24px;
		    height: 24px;
			display: flex;
			justify-content: center;
			align-items: center;
			cursor: default;
		}

		.stim-inspector .toolbox .btn:hover {
			background: #58a1dd;
		}

		.stim-content {
			width: 100%;
			padding: 8px;
			overflow: auto;
			font-size: 14px;
		}

		.stim-attr {
			display: flex;
			justify-content: flex-end;
			align-items: center;
			flex-wrap: nowrap;
			margin: 0 0 var(--rows-margin) 0;
		}

		.stim-attr.hidden {
			display: none;
		}

		.stim-attr .stim-attr-name {
			margin: 0 8px 0 0;
		}

		.stim-attr .stim-attr-input-wrapper {
			width: 194px;
		}

		.stim-inspector .filter-area {
			display: flex;
			height: var(--filter-area-height);
			border-bottom: 1px solid #6d747d;
		}

		.stim-inspector input,
		.stim-attr-input-wrapper input,
		.stim-attr-input-wrapper select {
			padding: 5px;
			border: none;
			width: 100%;
			border-radius: 3px;
			background: #e5e5e5;
			box-shadow: none;
			display: inline-block;
		}

		.stim-attr-input-wrapper input.error,
		.stim-attr-input-wrapper select.error {
			outline: 3px solid red;
			background: #ffd1d1;
		}

		.stim-attr-input-wrapper input[data-idx] {
			width: 60px;
			margin: 0 var(--rows-margin) 0 0;
		}

		.stim-attr-input-wrapper input[data-idx]:nth-child(3n + 3) {
			margin: 0;
		}

		.stim-attr-input-wrapper input[type="checkbox"] {
			width: auto;
		}

		.stim-attr-input-wrapper input[type="color"] {
			width: 25px;
			height: 25px;
			padding: 0px;
		}

		`
	}

	_injectStyles () {
		let s = document.createElement("style");
		s.textContent = this._getStyles();
		document.head.insertAdjacentElement('beforeend', s);
	}

	_constructHTML () {
		let html =
		`<div class="stim-inspector">
			<div class="grab-area">
				<div class="grab-area-title">Stim Inspector</div>
				<div class="window-controls-btn minimize" title="minimize">—</div>
			</div>
			<div class="filter-area">
				<input type="search" placeholder="Find attr"/>
			</div>
			<div class="content-area">
				<div class="toolbox">
					<div class="rebuild-stim btn" title="trigger full refresh">↻</div>
				</div>
				<div class="stim-content"></div>
			</div>
		</div>`;
		return html;
	}

	_construcInputHTMLForAttr (attrName, attrValue, stim) {
		let inputStep = 1;
		if (StimInspector.#FIELDS_WITH_FLOAT_DATA_TYPE[attrName]) {
			inputStep = StimInspector.#FIELDS_WITH_FLOAT_DATA_TYPE[attrName].step;
		}
		let inputHTML = "";
		if (attrName === "units") {
			inputHTML = this._constructSelectHTMLForAttr(attrName, attrValue, stim);
		} else if (attrValue instanceof Array) {
			if (attrValue.length === 0) {
				inputHTML = `<input type="text" disabled="true" data-name="${attrName}" value="Empty Array" />`;
			} else if (typeof attrValue[0] === "symbol") {
				inputHTML = this._constructSelectHTMLForAttr(attrName, attrValue, stim);
			} else if (typeof attrValue[0] === "object") {
				console.log("object array item", attrName, attrValue);
				inputHTML = `<input type="text" disabled="true" data-name="${attrName}" value="Array of Objects" />`;
			} else {
				let i;
				let arrElVal;
				let type;
				let dataAttrs = [];
				for (i = 0; i < attrValue.length; i++) {
					arrElVal = attrValue[i];
					type = "number";
					if (typeof arrElVal === "string") {
						type = "text";
					}
					inputHTML += `<input type="${type}" data-name="${attrName}" ${dataAttrs.join(" ")} value="${arrElVal}" data-idx="${i}" step="${inputStep}" />`;
				}
			}
		} else if (attrValue instanceof this._pjsLib.util.Color) {
			inputHTML = `<input type="color" data-name="${attrName}" value="${attrValue.hex}" />`;
		} else if (typeof attrValue === "boolean") {
			inputHTML = `<input type="checkbox" data-name="${attrName}" ${attrValue ? "checked" : ""} />`;
		} else if (typeof attrValue === "number") {
			inputHTML = `<input type="number" data-name="${attrName}" value="${attrValue}" step="${inputStep}" />`;
		} else if (typeof attrValue === "string") {
			inputHTML = `<input type="text" data-name="${attrName}" value="${attrValue}" />`;
		} else if (typeof attrValue === "object") {
			inputHTML = `<input type="text" disabled="true" data-name="${attrName}" value="Object field" />`;
		} else if (attrValue === undefined) {
			inputHTML = `<input type="text" data-name="${attrName}" value="undefined" />`;
		}
		return inputHTML;
	}

	_constructSelectHTMLFromObject (attrName, attrValue, opts) {
		let selectHTML = "";
		let optionsHTML = "";
		let selected = "";
		let optVal = "";
		let i;
		for (i in opts) {
			selected = opts[i] === attrValue ? "selected" : "";
			optVal = typeof opts[i] === "symbol" ? Symbol.keyFor(opts[i]) : opts[i];
			optionsHTML += `<option value="${optVal}" ${selected}>${optVal}</option>`
		}
		selectHTML = `<select data-name=${attrName}>${optionsHTML}</select>`;
		return selectHTML;
	}

	_constructSelectHTMLForAttr (attrName, attrValue, stim) {
		let selectHTML = "";
		let optionsHTML = "";
		let selectedVal = "";
		let opts = {};
		if (attrName === "style") {
			if (stim instanceof this._pjsLib.visual.Slider) {
				selectedVal = attrValue[0];
				opts = this._pjsLib.visual.Slider.Style;
			}
		} else if (attrName === "units") {
			selectedVal = attrValue;
			opts = StimInspector.#UNITS;
		}
		return this._constructSelectHTMLFromObject(attrName, selectedVal, opts);
	}

	_constructStimHTML (stim) {
		let html = "";
		let stimAttrsHTML = "";
		let inputHTML;
		let userAttrName;
		for (userAttrName of stim._userAttributes) {
			inputHTML = this._construcInputHTMLForAttr(userAttrName, stim[userAttrName], stim);
			stimAttrsHTML +=
			`<div class="stim-attr" data-name="${userAttrName}">
				<span class="stim-attr-name">${userAttrName}:</span>
				<span class="stim-attr-input-wrapper">${inputHTML}</span>
			</div>`;
		}

		html = `<div class="stim-attrs">${stimAttrsHTML}</div>`;

		return html;
	}

	_filterAttrsDOM (filterText = "") {
		let stimAttrs = document.querySelectorAll('.stim-attr');
		let i;
		for (i = 0; i < stimAttrs.length; i++) {
			if (stimAttrs[i].dataset.name.indexOf(filterText) !== -1) {
				stimAttrs[i].classList.remove('hidden');
			} else {
				stimAttrs[i].classList.add('hidden');
			}
		}
	}

	_onMouseDown (e) {
		e.preventDefault();
		this._grabbed = true;
	}

	_onMouseUp (e) {
		this._grabbed = false;
	}

	_onMouseMove (e) {
		if (!this._grabbed) {
			return;
		}
		let bcr = this._dom.getBoundingClientRect();
		let x = Math.max(0, Math.min(window.innerWidth - bcr.width, bcr.x + e.movementX));
		let y = Math.max(0, Math.min(window.innerHeight - bcr.height, bcr.y + e.movementY));
		this._dom.style.transform = `translate3d(${x}px, ${y}px, 0)`;
	}

	_onMinimizeClick (e) {
		this._dom.classList.toggle('minimized');
	}

	_onTriggerRefreshClick (e) {
		if (!this._inspectedStim) {
			return;
		}
		this._inspectedStim._needUpdate = true;
		this._inspectedStim._needPixiUpdate = true;
	}

	_onWindowClick (e) {
		let stims = this._pjsWin._stimsContainer.children;
		let clickedPixi;
		let clickedStim;
		const cursorPoint = {x: e.pageX, y: e.pageY};
		let tmpPoint = {x: 0, y: 0};
		let i;
		for (i = stims.length - 1; i >= 0; i--) {
			if (typeof stims[i].containsPoint === "function" && stims[i].containsPoint(cursorPoint)) {
				clickedPixi = stims[i];
				break;
			} else {
				stims[i].worldTransform.applyInverse(cursorPoint, tmpPoint);
				if (stims[i].getLocalBounds().contains(tmpPoint.x, tmpPoint.y)) {
					clickedPixi = stims[i];
					break;
				}
			}
		}

		for (i = 0; i < this._pjsWin._drawList.length; i++) {
			if (this._pjsWin._drawList[i]._pixi === clickedPixi) {
				clickedStim = this._pjsWin._drawList[i];
				break;
			}
		}

		if (clickedStim) {
			this.displayStimData(clickedStim);
		}
	}

	_onInspectorMouseWheel (e) {
		e.stopPropagation();
	}

	_onFilterInput (e) {
		this._filterAttrsDOM(e.currentTarget.value);
	}

	_onFilterKeydown (e) {
		if (e.which === StimInspector.#KEYCODES.ESC) {
			e.stopPropagation();
		}
	}

	_onAttrInputChange (e) {
		let attrName = e.currentTarget.dataset.name;
		let attrValue;
		e.currentTarget.type === "checkbox" ? e.currentTarget.checked : e.currentTarget.value;
		try {
			if (e.currentTarget.type === "checkbox") {
				attrValue = e.currentTarget.checked;
			} else if (e.currentTarget.type === "number") {
				attrValue = parseFloat(e.currentTarget.value);
			} else if (e.currentTarget.type === "color") {
				attrValue = new this._pjsLib.util.Color(e.currentTarget.value);
			} else {
				attrValue = e.currentTarget.value;
			}
			// so that it's possible to explicitly set to undefined or null
			if (attrValue === "undefined") {
				attrValue = undefined;
			} else if (attrValue === "null") {
				attrValue = null;
			}
			if (this._inspectedStim.hasOwnProperty(attrName)) {
				if (e.currentTarget.dataset.idx !== undefined) {
					let newVal = Array.from(this._inspectedStim[attrName]);
					newVal[parseInt(e.currentTarget.dataset.idx, 10)] = attrValue;
					this._inspectedStim[attrName] = newVal;
				} else {
					this._inspectedStim[attrName] = attrValue;
				}
			}
			e.currentTarget.title = "";
			e.currentTarget.classList.remove("error");
		} catch (err) {
			e.currentTarget.title = err.error.error;
			e.currentTarget.classList.add("error");
			console.log(err);
		}
	}

	_onAttrSelectChange (e) {
		let attrName = e.currentTarget.dataset.name;
		if (attrName === "style") {
			if (this._inspectedStim instanceof this._pjsLib.visual.Slider) {
				this._inspectedStim[attrName] = [e.currentTarget.value];
			}
		} else {
			this._inspectedStim[attrName] = e.currentTarget.value;
		}
	}

	_addEventListeners () {
		let dom = document.querySelector(".stim-inspector");
		let grabArea = dom.querySelector(".grab-area");
		let filterInput = dom.querySelector(".filter-area input");
		let triggerRefreshBtn = dom.querySelector(".rebuild-stim.btn");
		grabArea.addEventListener('mousedown', this._onMouseDown.bind(this));
		window.addEventListener('mouseup', this._onMouseUp.bind(this));
		window.addEventListener('mousemove', this._onMouseMove.bind(this));
		filterInput.addEventListener("input", this._onFilterInput.bind(this));
		filterInput.addEventListener("keydown", this._onFilterKeydown.bind(this));
		grabArea.querySelector('.window-controls-btn.minimize').addEventListener('click', this._onMinimizeClick.bind(this));
		triggerRefreshBtn.addEventListener('click', this._onTriggerRefreshClick.bind(this));
		dom.addEventListener('wheel', this._onInspectorMouseWheel.bind(this));
		window.addEventListener('click', this._onWindowClick.bind(this));
		this._dom = dom;
	}

	_addEventListenersForStim () {
		let inputs = this._dom.querySelectorAll('input');
		let selects = this._dom.querySelectorAll('select');
		let onInputChangeBinded = this._onAttrInputChange.bind(this);
		let onSelectChangeBinded = this._onAttrSelectChange.bind(this);
		let i;
		for (i = 0; i < inputs.length; i++) {
			inputs[i].addEventListener('input', onInputChangeBinded);
		}
		for (i = 0; i < selects.length; i++) {
			selects[i].addEventListener('change', onSelectChangeBinded);
		}
	}

	_init () {
		let html = this._constructHTML();
		this._injectStyles();
		document.body.insertAdjacentHTML('beforeend', html);
		this._addEventListeners();
	}

	displayStimData (stim) {
		this._inspectedStim = stim;
		let html = this._constructStimHTML(stim);
		this._dom.querySelector('.stim-content').innerHTML = html;
		this._addEventListenersForStim(stim);
		this._filterAttrsDOM(this._dom.querySelector('.filter-area input').value);
	}
};
