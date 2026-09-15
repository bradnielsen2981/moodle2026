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
 * Contains the default content output class.
 *
 * @package   format_multipageformat
 * @copyright 2020 Ferran Recio <ferran@moodle.com>
 * @license   http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

namespace format_multipageformat\output\courseformat;

use core_courseformat\output\local\content as content_base;
use format_multipageformat\tabs_manager;
use renderer_base;

/**
 * Base class to render a course content.
 *
 * @package   format_multipageformat
 * @copyright 2020 Ferran Recio <ferran@moodle.com>
 * @license   http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class content extends content_base {

    /**
     * @var bool Topic format has also add section after each topic.
     */
    protected $hasaddsection = true;

    /**
     * Export this data so it can be used as the context for a mustache template (core/inplace_editable).
     *
     * @param renderer_base $output typically, the renderer that's calling this function
     * @return stdClass data context for a mustache template
     */
    public function export_for_template(renderer_base $output) {
        global $PAGE;
        $PAGE->requires->js_call_amd('format_multipageformat/mutations', 'init');
        $PAGE->requires->js_call_amd('format_multipageformat/section', 'init');

        $data = parent::export_for_template($output);

        $tabs = $this->export_tabs();
        if (!empty($tabs)) {
            $PAGE->requires->js_call_amd('format_multipageformat/tabs', 'init', [$tabs]);
        }

        return $data;
    }

    /**
     * Builds the Tab grouping data used by the format_multipageformat/tabs AMD module.
     *
     * Tabs represent higher level sections: a section can be a Tab (grouping other
     * sections as its children) or a child of a Tab. Sections with no Tab relationship
     * at all are left untouched and always display normally.
     *
     * @return array list of ['sectionid' => int, 'childsectionids' => int[]]
     */
    protected function export_tabs(): array {
        $courseid = $this->format->get_courseid();
        $tabsectionids = tabs_manager::get_tab_sectionids($courseid);
        if (empty($tabsectionids)) {
            return [];
        }

        $tabs = [];
        foreach ($tabsectionids as $tabsectionid) {
            $tabs[] = [
                'sectionid' => $tabsectionid,
                'childsectionids' => tabs_manager::get_children_sectionids($courseid, $tabsectionid),
            ];
        }
        return $tabs;
    }

}
