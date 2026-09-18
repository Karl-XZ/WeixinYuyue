const cloudUtil = require('../../../../framework/cloud/cloud_util.js');
const dataUtil = require('../../../../framework/utils/data_util.js');

class MeetImageService {
	constructor({
		cloud = cloudUtil,
		data = dataUtil
	} = {}) {
		this._cloud = cloud;
		this._data = data;
	}

	_getFormValue(forms, mark) {
		if (!Array.isArray(forms) || !mark) return undefined;
		const field = forms.find(item => item && item.mark === mark);
		return field ? field.val : undefined;
	}

	_hasArrayValue(value) {
		return Array.isArray(value) && value.filter(Boolean).length > 0;
	}

	_hasTextValue(value) {
		return value !== undefined && value !== null && String(value).trim() !== '';
	}

	hasDisplayCover(meetObj = {}) {
		return this._hasArrayValue(meetObj.cover);
	}

	getCoverSrc(meetObj = {}, defaultCover = '/images/cover.gif') {
		if (Array.isArray(meetObj.cover) && meetObj.cover.length > 0) return meetObj.cover[0];
		if (typeof meetObj.cover === 'string' && meetObj.cover.trim()) return meetObj.cover.trim();
		return defaultCover;
	}

	async _safeGetTempFileURL(cloudIds = []) {
		try {
			return await this._cloud.getTempFileURL(cloudIds);
		} catch (err) {
			return null;
		}
	}

	buildDisplayObj(meet = {}, fallbackMeet = null, applyDefaultCover = true) {
		const currentObj = meet && meet.MEET_OBJ && typeof meet.MEET_OBJ === 'object' ? this._data.deepClone(meet.MEET_OBJ) : {};
		const currentForms = Array.isArray(meet && meet.MEET_FORMS) ? meet.MEET_FORMS : [];
		const fallbackObj = fallbackMeet && fallbackMeet.MEET_OBJ && typeof fallbackMeet.MEET_OBJ === 'object' ? fallbackMeet.MEET_OBJ : {};
		const fallbackForms = Array.isArray(fallbackMeet && fallbackMeet.MEET_FORMS) ? fallbackMeet.MEET_FORMS : [];

		const ret = currentObj;
		const mergeTextField = (field) => {
			if (this._hasTextValue(ret[field])) return;
			const currentVal = this._getFormValue(currentForms, field);
			if (this._hasTextValue(currentVal)) {
				ret[field] = currentVal;
				return;
			}
			const fallbackVal = fallbackObj[field];
			if (this._hasTextValue(fallbackVal)) {
				ret[field] = fallbackVal;
				return;
			}
			const fallbackFormVal = this._getFormValue(fallbackForms, field);
			if (this._hasTextValue(fallbackFormVal)) ret[field] = fallbackFormVal;
		};

		const mergeArrayField = (field) => {
			if (this._hasArrayValue(ret[field])) return;
			const currentVal = this._getFormValue(currentForms, field);
			if (this._hasArrayValue(currentVal)) {
				ret[field] = currentVal;
				return;
			}
			const fallbackVal = fallbackObj[field];
			if (this._hasArrayValue(fallbackVal)) {
				ret[field] = fallbackVal;
				return;
			}
			const fallbackFormVal = this._getFormValue(fallbackForms, field);
			if (this._hasArrayValue(fallbackFormVal)) ret[field] = fallbackFormVal;
		};

		mergeTextField('level');
		mergeTextField('spec');
		mergeTextField('desc');
		mergeTextField('location');
		mergeArrayField('cover');
		mergeArrayField('content');

		if (applyDefaultCover && (!Array.isArray(ret.cover) || ret.cover.length === 0)) ret.cover = ['/images/cover.gif'];
		if (!Array.isArray(ret.content)) ret.content = [];
		if (!this._hasTextValue(ret.spec)) ret.spec = '';
		if (!this._hasTextValue(ret.desc)) ret.desc = '';
		if (!this._hasTextValue(ret.location)) ret.location = '';

		return ret;
	}

	async replaceCloudImageList(list) {
		if (!Array.isArray(list)) return [];
		if (list.length === 0) return list;

		const cloudIds = list.filter(item => typeof item === 'string' && item.indexOf('cloud://') === 0);
		if (cloudIds.length === 0) return list;

		const tempList = await this._safeGetTempFileURL(cloudIds);
		const urlMap = {};
		for (const item of tempList || []) {
			urlMap[item.cloudId] = item.url;
		}

		return list.map(item => urlMap[item] || item);
	}

	async formatMeetObjImages(meetObj = {}) {
		if (!meetObj || typeof meetObj !== 'object') return meetObj;

		const ret = this._data.deepClone(meetObj);

		if (Array.isArray(ret.cover) && ret.cover.length > 0) {
			ret.cover = await this.replaceCloudImageList(ret.cover);
		}

		if (Array.isArray(ret.content) && ret.content.length > 0) {
			const cloudIds = ret.content
				.filter(item => item && item.type === 'img' && typeof item.val === 'string' && item.val.indexOf('cloud://') === 0)
				.map(item => item.val);

			if (cloudIds.length > 0) {
				const tempList = await this._safeGetTempFileURL(cloudIds);
				const urlMap = {};
				for (const item of tempList || []) {
					urlMap[item.cloudId] = item.url;
				}

				ret.content = ret.content.map(item => {
					if (!item || item.type !== 'img') return item;
					return Object.assign({}, item, {
						val: urlMap[item.val] || item.val
					});
				});
			}
		}

		return ret;
	}

	async formatMeetImages(meet) {
		if (!meet || !meet.MEET_OBJ) return meet;
		meet.MEET_OBJ = await this.formatMeetObjImages(meet.MEET_OBJ);
		return meet;
	}
}

module.exports = MeetImageService;
