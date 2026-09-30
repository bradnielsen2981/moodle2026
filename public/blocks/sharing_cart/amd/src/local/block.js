import {BaseComponent} from 'core/reactive';
import {get_string as getString} from 'core/str';
import {getCurrentCourseEditor} from "core_courseformat/courseeditor";
import BaseFactory from "../app/factory";

export default class Block extends BaseComponent {
    /**
     * @type {CourseElement}
     */
    course;

    /**
     * @type {BlockElement}
     */
    block;

    /**
     * @type {QueueElement}
     */
    queue;

    /**
     * Constructor hook.
     * @param {Object} descriptor
     */
    create(descriptor) {
        // Optional component name for debugging.
        this.name = 'sharing_cart_block';
        // Default query selectors.
        this.selectors = {
            COPY_SECTION_CONTAINER: '#copy_section_container',
        };

        this.canBackupUserdata = descriptor.canBackupUserdata ?? false;
        this.canAnonymizeUserdata = descriptor.canAnonymizeUserdata ?? false;
        this.canBackup = descriptor.canBackup ?? false;
        this.showSharingCartBasket = descriptor.showSharingCartBasket ?? false;
        this.showCopiesQueuedSegmentWhenEmpty = descriptor.showCopiesQueuedSegmentWhenEmpty ?? true;
    }

    /**
     * Static method to create a component instance form the mustache template.
     *
     * @param {String} target
     * @param {Boolean} canBackupUserdata
     * @param {Boolean} canAnonymizeUserdata
     * @param {Boolean} canBackup
     * @param {Boolean} showSharingCartBasket
     * @param {Boolean} showCopiesQueuedSegmentWhenEmpty
     */
    static init(
        target,
        canBackupUserdata,
        canAnonymizeUserdata,
        canBackup,
        showSharingCartBasket,
        showCopiesQueuedSegmentWhenEmpty
    ) {
        return new this({
            element: document.getElementById(target),
            reactive: getCurrentCourseEditor(),
            canBackupUserdata,
            canAnonymizeUserdata,
            canBackup,
            showSharingCartBasket,
            showCopiesQueuedSegmentWhenEmpty
        });
    }

    /**
     * Initial state ready method.
     */
    stateReady() {
        this.baseFactory = BaseFactory.make();
        const {course, block, queue} = this.baseFactory.block().eventHandler().onLoad(
            this.canBackupUserdata,
            this.canAnonymizeUserdata,
            this.canBackup,
            this.showSharingCartBasket,
            this.showCopiesQueuedSegmentWhenEmpty
        );

        this.course = course;
        this.block = block;
        this.queue = queue;

        this._setupMenuItemListener();
        this._addMenuItems();

        const showCopySectionInBlockSegment = this.getElement(this.selectors.COPY_SECTION_CONTAINER);
        if (showCopySectionInBlockSegment) {
            this._refreshCopySectionOptions();

            const select = showCopySectionInBlockSegment.querySelector('select');
            const copySectionButton = showCopySectionInBlockSegment.querySelector('button');
            copySectionButton.addEventListener('click', async () => {
                await this.block.addSectionBackupToSharingCart(select.value);
            });
        }
    }

    /**
     * Component watchers.
     *
     * @returns {Array} of watchers
     */
    getWatchers() {
        return [
            {watch: `section:created`, handler: this._refreshSection},
            {watch: `section:updated`, handler: this._refreshSection},
            {watch: `section.dragging:created`, handler: this._onDraggingSection},
            {watch: `section.dragging:updated`, handler: this._onDraggingSection},
            {watch: `cm.dragging:created`, handler: this._onDraggingCourseModule},
            {watch: `cm.dragging:updated`, handler: this._onDraggingCourseModule},
            {watch: `cm:created`, handler: this._refreshCourseModule},
            {watch: `cm:updated`, handler: this._refreshCourseModule},
        ];
    }

    async getSharingCartMenuItem() {
        if (!this._sharingCartMenuItem) {
            this._sharingCartMenuItem = await this.baseFactory.moodle().template().createElementFromTemplate(
                'block_sharing_cart/block/course/add_to_sharing_cart_menu_item',
                {}
            );
        }

        return this._sharingCartMenuItem.cloneNode(true);
    }

    /**
     * Whether the "Add to Sharing Cart" edit menu items should be shown.
     * @returns {boolean}
     */
    showMenuItems() {
        return this.showSharingCartBasket && this.canBackup;
    }

    /**
     * Handles clicks on "Add to Sharing Cart" edit menu items anywhere in the course content.
     */
    _setupMenuItemListener() {
        const courseContent = document.querySelector('.course-content');
        if (!courseContent || !this.showMenuItems()) {
            return;
        }

        courseContent.addEventListener('click', (e) => {
            const menuItem = e.target.closest('[data-sharing-cart-action="add"]');
            if (!menuItem) {
                return;
            }
            e.preventDefault();

            if (menuItem.classList.contains('disabled')) {
                return;
            }

            const courseModuleMenu = menuItem.closest('.cm_action_menu[data-cmid]');
            if (courseModuleMenu) {
                this.block.addCourseModuleBackupToSharingCart(courseModuleMenu.dataset.cmid);
                return;
            }

            const sectionMenu = menuItem.closest('.section_action_menu[data-sectionid]');
            if (sectionMenu) {
                this.block.addSectionBackupToSharingCart(sectionMenu.dataset.sectionid);
            }
        });

        // Edit menus are re-rendered by the course editor, so re-add the menu item whenever the content changes.
        let pending = false;
        new MutationObserver(() => {
            if (pending) {
                return;
            }
            pending = true;
            requestAnimationFrame(() => {
                pending = false;
                this._addMenuItems();
            });
        }).observe(courseContent, {childList: true, subtree: true});
    }

    /**
     * Add the "Add to Sharing Cart" item to every section and activity edit menu that does not have it yet.
     */
    async _addMenuItems() {
        if (!this.showMenuItems()) {
            return;
        }

        const menus = document.querySelectorAll(
            '.course-content .section_action_menu[data-sectionid] .dropdown-menu,' +
            '.course-content .cm_action_menu[data-cmid] .dropdown-menu'
        );
        for (const menu of menus) {
            // Skip submenus (e.g. "Group mode") nested inside the edit menu.
            if (menu.parentElement.closest('.dropdown-menu')) {
                continue;
            }
            if (menu.querySelector('.add_to_sharing_cart')) {
                continue;
            }

            const menuItem = await this.getSharingCartMenuItem();
            if (menu.querySelector('.add_to_sharing_cart')) {
                continue;
            }

            // Place it just above the delete option (and its divider) when present.
            let before = menu.querySelector('[data-action="cmDelete"],[data-action="deleteSection"]');
            if (before && before.previousElementSibling?.matches('.dropdown-divider')) {
                before = before.previousElementSibling;
            }
            menu.insertBefore(menuItem, before);

            const sectionMenu = menu.closest('.section_action_menu[data-sectionid]');
            if (sectionMenu) {
                await this._updateSectionMenuItemState(sectionMenu.dataset.sectionid);
            }
        }
    }

    /**
     * Disable the section's "Add to Sharing Cart" menu item when the section has no course modules.
     * @param {number|string} sectionId
     */
    async _updateSectionMenuItemState(sectionId) {
        const menuItem = document.querySelector(
            '.course-content .section_action_menu[data-sectionid="' + sectionId + '"] .add_to_sharing_cart'
        );
        const section = this.reactive.state.section.get(sectionId);
        if (!menuItem || !section) {
            return;
        }

        const disabled = section.cmlist.length === 0;
        menuItem.classList.toggle('disabled', disabled);
        menuItem.setAttribute('aria-disabled', disabled ? 'true' : 'false');
        menuItem.title = disabled ?
            await getString('no_course_modules_in_section_description', 'block_sharing_cart') :
            '';
    }

    async _refreshCopySectionOptions() {
        const showCopySectionInBlockSegment = this.getElement(this.selectors.COPY_SECTION_CONTAINER);
        if (!showCopySectionInBlockSegment) {
            return;
        }

        const select = showCopySectionInBlockSegment.querySelector('select');
        const selectedValue = select.value;

        const noCourseModulesInSections = await getString('no_course_modules_in_section', 'block_sharing_cart');

        const div = document.createElement('div');

        const option = document.createElement('option');
        option.disabled = true;
        option.text = await getString('choosedots', 'core');
        div.appendChild(option);

        this.reactive.state.section.forEach((section) => {
            const option = document.createElement('option');

            const sectionIsEmpty = section.cmlist.length === 0;
            if (sectionIsEmpty) {
                option.disabled = true;
                option.title = noCourseModulesInSections;
            }

            option.value = section.id;
            option.text = section.title;
            option.selected = Number.parseInt(section.id) === Number.parseInt(selectedValue);

            div.appendChild(option);
        });

        select.innerHTML = div.innerHTML;
    }

    /**
     * Refresh the section.
     * @param {Object} param
     * @param {Object} param.element
     */
    async _refreshSection({element}) {
        this._refreshCopySectionOptions();
        await this._addMenuItems();
        await this._updateSectionMenuItemState(element.id);
    }

    /**
     * Refresh the course module.
     */
    async _refreshCourseModule() {
        await this._addMenuItems();
    }

    /**
     * On dragging section
     * @param {Object} param
     * @param {Object} param.element
     */
    async _onDraggingSection({element}) {
        if (element.dragging) {
            this.block.getElement().classList.add('dragging_item');
            this.block.setDraggedSectionId(element.id);
        } else {
            this.block.getElement().classList.remove('dragging_item');
            this.block.setDraggedSectionId(null);
        }
    }

    /**
     * On dragging course module
     * @param {Object} param
     * @param {Object} param.element
     */
    async _onDraggingCourseModule({element}) {
        if (element.dragging) {
            this.block.getElement().classList.add('dragging_item');
            this.block.setDraggedCourseModuleId(element.id);
        } else {
            this.block.getElement().classList.remove('dragging_item');
            this.block.setDraggedCourseModuleId(null);
        }
    }
}
