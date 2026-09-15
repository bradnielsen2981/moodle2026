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
 * Renders the Tabs UI for format_multipageformat.
 *
 * Tabs represent higher level sections: a Tab section groups other sections as its
 * children. This module builds a clickable tab strip from the Tab sections already
 * rendered on the page and shows/hides the relevant section boxes client-side.
 * Sections with no Tab relationship are left untouched and always stay visible.
 *
 * @module     format_multipageformat/tabs
 * @copyright  2026 Brad Nielsen
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

const SELECTORS = {
    SECTIONLIST: '[data-for="course_sectionlist"]',
    SECTION: (id) => `li[data-for="section"][data-id="${id}"]`,
    TABLINK: '[data-tabid]',
};

const CLASSES = {
    HIDDEN: 'd-none',
};

/**
 * Resolve the tab definitions (from PHP) into their DOM elements.
 *
 * @param {Element} sectionList the section list container
 * @param {Array} tabs array of {sectionid, childsectionids}
 * @return {Array} resolved tabs, each with {sectionid, name, groupEls}
 */
const resolveTabs = (sectionList, tabs) => {
    return tabs.map(tab => {
        // Normalise to Number: dataset attributes are always strings, and we
        // must not rely on the PHP layer returning ints rather than numeric strings.
        const sectionid = Number(tab.sectionid);
        const tabEl = sectionList.querySelector(SELECTORS.SECTION(sectionid));
        if (!tabEl) {
            // The Tab section is not visible on this page (e.g. viewing a single
            // section), nothing to render for it.
            return null;
        }
        const childEls = tab.childsectionids
            .map(id => sectionList.querySelector(SELECTORS.SECTION(Number(id))))
            .filter(el => el !== null);
        return {
            sectionid,
            name: tabEl.dataset.sectionname,
            groupEls: [tabEl, ...childEls],
        };
    }).filter(tab => tab !== null);
};

/**
 * Build the tab strip DOM (a nav-tabs list wrapped in a single <li> so it stays
 * valid inside the section <ul>).
 *
 * @param {Array} resolvedTabs resolved tabs from resolveTabs()
 * @param {Function} onSelect callback invoked with the sectionid of the clicked tab
 * @return {Element} the wrapper <li> ready to be inserted into the section list
 */
const buildTabStrip = (resolvedTabs, onSelect) => {
    const wrapper = document.createElement('li');
    wrapper.className = 'format-multipageformat-tabs-wrapper';
    wrapper.style.listStyle = 'none';

    const nav = document.createElement('ul');
    nav.className = 'nav nav-tabs format-multipageformat-tabs mb-3';
    nav.setAttribute('role', 'tablist');

    resolvedTabs.forEach(tab => {
        const item = document.createElement('li');
        item.className = 'nav-item';
        item.setAttribute('role', 'presentation');

        const link = document.createElement('a');
        link.href = '#';
        link.className = 'nav-link';
        link.dataset.tabid = tab.sectionid;
        link.setAttribute('role', 'tab');
        link.textContent = tab.name;
        link.addEventListener('click', (event) => {
            event.preventDefault();
            onSelect(tab.sectionid);
        });

        item.appendChild(link);
        nav.appendChild(item);
    });

    wrapper.appendChild(nav);
    return wrapper;
};

/**
 * Initialise the Tabs UI.
 *
 * @param {Array} tabs array of {sectionid: number, childsectionids: number[]} as built
 *     by format_multipageformat\output\courseformat\content::export_tabs()
 */
export const init = (tabs) => {
    if (!tabs || !tabs.length) {
        return;
    }

    const sectionList = document.querySelector(SELECTORS.SECTIONLIST);
    if (!sectionList) {
        return;
    }

    const resolvedTabs = resolveTabs(sectionList, tabs);
    if (!resolvedTabs.length) {
        return;
    }

    const setActive = (activeSectionId) => {
        resolvedTabs.forEach(tab => {
            const isActive = tab.sectionid === activeSectionId;
            tab.groupEls.forEach(el => el.classList.toggle(CLASSES.HIDDEN, !isActive));
        });
        strip.querySelectorAll(SELECTORS.TABLINK).forEach(link => {
            const isActive = Number(link.dataset.tabid) === activeSectionId;
            link.classList.toggle('active', isActive);
            link.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });
    };

    const strip = buildTabStrip(resolvedTabs, setActive);

    // Insert the strip right before the first tabbed section so untabbed sections
    // keep rendering above it, undisturbed.
    sectionList.insertBefore(strip, resolvedTabs[0].groupEls[0]);

    setActive(resolvedTabs[0].sectionid);
};
