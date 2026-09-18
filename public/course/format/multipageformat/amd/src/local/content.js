// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <http://www.gnu.org/licenses/>.

/**
 * Course format component for format_multipageformat.
 *
 * The only change from core_courseformat/local/content is which Section class it builds,
 * so sections get the extra "drop into a section to nest it" dropzone (see
 * format_multipageformat/local/content/section).
 *
 * @module     format_multipageformat/local/content
 * @copyright  2026 Brad Nielsen
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import Component from 'core_courseformat/local/content';
import Section from 'format_multipageformat/local/content/section';

export default class extends Component {

    /**
     * Constructor hook.
     *
     * @param {Object} descriptor the component descriptor
     */
    create(descriptor) {
        super.create(descriptor);
        // Optional component name for debugging.
        this.name = 'course_format_multipageformat';
    }

    /**
     * Create a new Section object.
     *
     * @param {Object} item the constructor data
     * @return {Section} the new object
     */
    _newSection(item) {
        return new Section(item);
    }
}
