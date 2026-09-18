<?php
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
 * Contains the subsection controls output class.
 *
 * @package   format_multipageformat
 * @copyright 2026 Brad Nielsen
 * @license   http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

namespace format_multipageformat\output\courseformat\content\cm;

use core\output\action_menu\link_secondary as action_menu_link_secondary;
use core\output\pix_icon;
use core_courseformat\output\local\content\cm\delegatedcontrolmenu as delegatedcontrolmenu_base;

/**
 * Base class to render a subsection's own control menu.
 *
 * @package   format_multipageformat
 * @copyright 2026 Brad Nielsen
 * @license   http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class delegatedcontrolmenu extends delegatedcontrolmenu_base {

    /**
     * Generate the edit control items of a subsection.
     *
     * @return array of edit control items
     */
    public function delegated_control_items() {
        $controls = parent::delegated_control_items();

        if ($this->canmanageactivities && has_capability('moodle/course:update', $this->coursecontext)) {
            $controls = $this->add_control_after($controls, 'edit', 'detach', $this->get_section_detach_item());
        }

        return $controls;
    }

    /**
     * Retrieves the "Make own section" item for the subsection control menu.
     *
     * Detaches the subsection from its parent, turning it into its own independent
     * section placed immediately below the section it belonged to.
     *
     * @return action_menu_link_secondary
     */
    protected function get_section_detach_item(): action_menu_link_secondary {
        $url = $this->format->get_update_url(
            action: 'section_detach',
            ids: [$this->section->id],
            returnurl: $this->baseurl,
        );

        return new action_menu_link_secondary(
            url: $url,
            icon: new pix_icon('t/right', ''),
            text: get_string('makeownsection', 'format_multipageformat'),
            attributes: [
                'class' => 'editing_detach',
                'data-id' => $this->section->id,
            ],
        );
    }
}
