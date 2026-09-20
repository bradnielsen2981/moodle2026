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

import {open as openAddPage} from 'format_multipageformat/addpage';

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

        // Mark the Tab and its children in the DOM so other components (e.g. the section
        // drag and drop validation) can tell a Tab relationship apart without needing their
        // own copy of this data - a Tab must stay above all of its own children at all times.
        tabEl.dataset.tabSection = 'true';
        tabEl.dataset.tabChildren = childEls.map(el => el.dataset.id).join(',');
        childEls.forEach(el => {
            el.dataset.tabParent = String(sectionid);
        });

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
 * @param {string} addPageLabel label of the trailing "Add page" tab, or empty for none
 * @return {Element} the wrapper <li> ready to be inserted into the section list
 */
const buildTabStrip = (resolvedTabs, onSelect, addPageLabel) => {
    const wrapper = document.createElement('li');
    wrapper.className = 'format-multipageformat-tabs-wrapper';
    wrapper.style.listStyle = 'none';

    // Core's section-list reordering (see the observer set up in init()) removes any
    // list item it does not recognise as a section unless it is flagged as an orphan,
    // in which case it is preserved (moved to the end of the list instead of deleted).
    wrapper.dataset.orphan = 'true';

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

    if (addPageLabel) {
        // A trailing tab that creates a new page. It has no data-tabid, so it is never treated
        // as one of the pages.
        const item = document.createElement('li');
        item.className = 'nav-item';
        item.setAttribute('role', 'presentation');

        const link = document.createElement('a');
        link.href = '#';
        link.className = 'nav-link format-multipageformat-addpage';
        const icon = document.createElement('i');
        icon.className = 'icon fa fa-plus fa-fw';
        icon.setAttribute('aria-hidden', 'true');
        link.append(icon, addPageLabel);
        link.addEventListener('click', (event) => {
            event.preventDefault();
            openAddPage();
        });

        item.appendChild(link);
        nav.appendChild(item);
    }

    wrapper.appendChild(nav);
    return wrapper;
};

/**
 * Build the sessionStorage key used to remember the active tab for a course.
 *
 * A plain edit action (making a page, attaching or detaching a subsection, ...) reloads
 * the whole page to pick up the new tab layout, which would otherwise always reset the
 * view back to the first tab. sessionStorage survives that reload (it is only cleared
 * when the browser tab itself closes), so the active tab can be restored afterwards.
 *
 * @param {number} courseId the course id
 * @return {string} the storage key
 */
const storageKey = (courseId) => `format_multipageformat/activetab/${courseId}`;

/**
 * Initialise the Tabs UI.
 *
 * @param {Array} tabs array of {sectionid: number, childsectionids: number[]} as built
 *     by format_multipageformat\output\courseformat\content::export_tabs()
 * @param {number} courseId the course id, used to remember the active tab across reloads
 * @param {string} addPageLabel label of the "Add page" tab (edit mode only), empty for none
 */
export const init = (tabs, courseId, addPageLabel = '') => {
    if (!tabs || !tabs.length) {
        return;
    }

    const sectionList = document.querySelector(SELECTORS.SECTIONLIST);
    if (!sectionList) {
        return;
    }

    let resolvedTabs = resolveTabs(sectionList, tabs);
    if (!resolvedTabs.length) {
        return;
    }

    const key = storageKey(courseId);
    const rememberActive = (sectionId) => {
        try {
            sessionStorage.setItem(key, sectionId);
        } catch (e) {
            // Private browsing or storage disabled - the tab just won't be remembered.
            return;
        }
    };
    const getRememberedActive = () => {
        try {
            const stored = Number(sessionStorage.getItem(key));
            return resolvedTabs.some(tab => tab.sectionid === stored) ? stored : null;
        } catch (e) {
            return null;
        }
    };

    let activeSectionId = getRememberedActive() ?? resolvedTabs[0].sectionid;
    let strip = null;

    const setActive = (sectionId) => {
        activeSectionId = sectionId;
        rememberActive(sectionId);
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

    strip = buildTabStrip(resolvedTabs, setActive, addPageLabel);

    // The strip belongs right before the first tabbed section so untabbed sections
    // keep rendering above it, undisturbed.
    const reposition = () => {
        const anchor = resolvedTabs[0]?.groupEls[0];
        if (anchor && strip.nextElementSibling !== anchor) {
            sectionList.insertBefore(strip, anchor);
        }
    };

    // Drop any tab whose own section has been deleted. Its content is gone with it
    // (it lived in the Tab section's own activities), so there is nothing left to
    // show for it - remove its nav-link too instead of leaving a dead button behind.
    const pruneDeletedTabs = () => {
        let activeWasRemoved = false;
        resolvedTabs = resolvedTabs.filter(tab => {
            if (sectionList.contains(tab.groupEls[0])) {
                return true;
            }
            strip.querySelector(`[data-tabid="${tab.sectionid}"]`)?.closest('li')?.remove();
            activeWasRemoved = activeWasRemoved || (tab.sectionid === activeSectionId);
            return false;
        });

        if (!resolvedTabs.length) {
            strip.remove();
            return;
        }
        if (activeWasRemoved) {
            setActive(resolvedTabs[0].sectionid);
        }
    };

    // Reordering sections (e.g. dragging one above another) makes core rebuild the
    // section list to match the new state order. It does not know about this strip,
    // so it gets pushed out and re-appended at the very end of the list instead of
    // being deleted (see the 'orphan' flag above) - put it back where it belongs.
    // Deleting a section runs through the same rebuild, so this also catches Tabs
    // that just got deleted.
    const sync = () => {
        if (!strip.isConnected) {
            return;
        }
        pruneDeletedTabs();
        reposition();
    };

    reposition();
    setActive(activeSectionId);

    const observer = new MutationObserver(sync);
    observer.observe(sectionList, {childList: true});

    // Renaming a section is a separate inplace_editable component nested inside the
    // section header, so it does not go through the section-list mutations above.
    // Keep the tab's nav-link (and its cached name) in sync when a Tab gets renamed.
    sectionList.addEventListener('core/inplace_editable:updated', (event) => {
        const target = event.target;
        const itemtype = target?.dataset?.itemtype;
        if (
            target?.dataset?.component !== 'format_multipageformat'
            || (itemtype !== 'sectionname' && itemtype !== 'sectionnamenl')
        ) {
            return;
        }

        const sectionid = Number(target.dataset.itemid);
        const tab = resolvedTabs.find(t => t.sectionid === sectionid);
        if (!tab) {
            return;
        }

        const newname = target.dataset.value;
        tab.name = newname;
        tab.groupEls[0].dataset.sectionname = newname;
        const link = strip.querySelector(`[data-tabid="${tab.sectionid}"]`);
        if (link) {
            link.textContent = newname;
        }
    });
};
