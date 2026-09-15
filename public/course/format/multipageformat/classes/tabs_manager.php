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
 * Stores and reads the section grouping used by Tabs.
 *
 * @package   format_multipageformat
 * @copyright 2026 Brad Nielsen
 * @license   http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

namespace format_multipageformat;

/**
 * Manages the 'parent' rows in {custom_course_format_options} used to group
 * sections into Tabs.
 *
 * A section that is itself a Tab is stored with value = self::TAB (-1).
 * A section that belongs to a Tab is stored with value = <the tab's sectionid>.
 * A section that is neither a Tab nor a member of one has no row at all.
 *
 * @package   format_multipageformat
 * @copyright 2026 Brad Nielsen
 * @license   http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class tabs_manager {

    /** @var string The course format this manager stores options for. */
    const FORMAT = 'multipageformat';

    /** @var string The option name used for the Tabs grouping. */
    const OPTIONNAME = 'parent';

    /** @var int Sentinel value stored for a section that is itself a Tab. */
    const TAB = -1;

    /**
     * Returns the raw 'parent' value stored for a section.
     *
     * @param int $sectionid
     * @return int|null self::TAB (-1) if the section is a Tab, the parent tab's sectionid if the
     *     section belongs to a Tab, or null if the section has no Tab relationship at all.
     */
    public static function get_parent(int $sectionid): ?int {
        global $DB;
        $value = $DB->get_field('custom_course_format_options', 'value', [
            'format' => self::FORMAT,
            'sectionid' => $sectionid,
            'name' => self::OPTIONNAME,
        ]);
        return ($value === false) ? null : (int)$value;
    }

    /**
     * Whether the given section is itself a Tab.
     *
     * @param int $sectionid
     * @return bool
     */
    public static function is_tab(int $sectionid): bool {
        return self::get_parent($sectionid) === self::TAB;
    }

    /**
     * Whether the given section belongs to (is a child of) a Tab.
     *
     * @param int $sectionid
     * @return bool
     */
    public static function is_tab_child(int $sectionid): bool {
        $parent = self::get_parent($sectionid);
        return $parent !== null && $parent !== self::TAB;
    }

    /**
     * Marks a section as a Tab (top-level, no parent).
     *
     * @param int $courseid
     * @param int $sectionid
     */
    public static function set_as_tab(int $courseid, int $sectionid): void {
        self::set_parent($courseid, $sectionid, self::TAB);
    }

    /**
     * Marks a section as belonging to (a child of) a Tab.
     *
     * @param int $courseid
     * @param int $sectionid the section becoming a child
     * @param int $tabsectionid the section id of the Tab it belongs to
     */
    public static function set_tab_child(int $courseid, int $sectionid, int $tabsectionid): void {
        self::set_parent($courseid, $sectionid, $tabsectionid);
    }

    /**
     * Removes any Tab relationship stored for a section, e.g. when it stops being
     * a Tab or is removed from one.
     *
     * @param int $sectionid
     */
    public static function remove(int $sectionid): void {
        global $DB;
        $DB->delete_records('custom_course_format_options', [
            'format' => self::FORMAT,
            'sectionid' => $sectionid,
            'name' => self::OPTIONNAME,
        ]);
    }

    /**
     * Returns the section ids of all Tabs in a course.
     *
     * @param int $courseid
     * @return int[]
     */
    public static function get_tab_sectionids(int $courseid): array {
        global $DB;
        $sectionids = $DB->get_fieldset_select(
            'custom_course_format_options',
            'sectionid',
            'courseid = :courseid AND format = :format AND name = :name AND value = :value',
            [
                'courseid' => $courseid,
                'format' => self::FORMAT,
                'name' => self::OPTIONNAME,
                'value' => (string) self::TAB,
            ]
        );
        return array_values(array_map('intval', $sectionids));
    }

    /**
     * Returns the section ids of the direct children of a Tab.
     *
     * @param int $courseid
     * @param int $tabsectionid
     * @return int[]
     */
    public static function get_children_sectionids(int $courseid, int $tabsectionid): array {
        global $DB;
        $sectionids = $DB->get_fieldset_select(
            'custom_course_format_options',
            'sectionid',
            'courseid = :courseid AND format = :format AND name = :name AND value = :value',
            [
                'courseid' => $courseid,
                'format' => self::FORMAT,
                'name' => self::OPTIONNAME,
                'value' => (string) $tabsectionid,
            ]
        );
        return array_values(array_map('intval', $sectionids));
    }

    /**
     * Inserts or updates the 'parent' row for a section.
     *
     * @param int $courseid
     * @param int $sectionid
     * @param int $value self::TAB (-1) if this section is a Tab, otherwise the parent tab's sectionid
     */
    protected static function set_parent(int $courseid, int $sectionid, int $value): void {
        global $DB;
        $params = [
            'courseid' => $courseid,
            'format' => self::FORMAT,
            'sectionid' => $sectionid,
            'name' => self::OPTIONNAME,
        ];
        $existing = $DB->get_record('custom_course_format_options', $params);
        if ($existing) {
            $existing->value = $value;
            $DB->update_record('custom_course_format_options', $existing);
        } else {
            $params['value'] = $value;
            $DB->insert_record('custom_course_format_options', $params);
        }
    }
}
