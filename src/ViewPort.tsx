import React from "react";
import "pepjs";
import "./styles/shelfview.scss";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faCheckCircle as tickSolid} from "@fortawesome/free-solid-svg-icons";
import {Shelf, Tray} from "./core/MockWarehouse";


interface ViewPortProps {
    shelf: Shelf;
    selected: Map<Tray, boolean>;
}

/**
 * This is the type for the field in the state of the viewport which controls the dragging behaviour
 */
interface LongPress {
    isHappening: boolean;
    timeout?: number;
    dragFrom: Tray;
    selectedBefore: Map<Tray, boolean>;
}

/**
 * The state of the ViewPort
 */
interface ViewPortState {
    longPress?: LongPress | null;
    multipleSelect: boolean;
}

/**
 * The long press to drag timeout in milliseconds
 */
const LONG_PRESS_TIMEOUT = 300;

/**
 * This class crates and manages the behavior of the viewport
 * // todo fixme ensure that the selection is always handled safely
 */
export class ViewPort extends React.Component<ViewPortProps, ViewPortState> {

    constructor(props: ViewPortProps) {
        super(props);
        this.state = {
            longPress: null,
            multipleSelect: false,
        };
    }

    /**
     * This method is called when a dragging event is started.  This event is started when the timeout which is started
     * inside onTrayPointerDown succeeds.  This timeout could fail iff the pointer leaves the tray or if the pointer is
     * released before the timeout finishes.
     */
    onDragSelectStart() {

        const selectedBefore = new Map();
        this.props.selected.forEach((selected, tray) => {
            selectedBefore.set(tray, selected);
        });

        this.setState({
            ...this.state,
            multipleSelect: true,
            longPress: {
                isHappening: true,
                timeout: undefined,
                dragFrom: this.state.longPress?.dragFrom!!,
                selectedBefore: selectedBefore,
            },
        }, () => {
            this.updateDragSelectionTo(this.state.longPress?.dragFrom!!);
        });
    }

    /**
     * This method is called to update the state of the drag event.  It is called when the pointer enters a new tray
     * while the viewport is in dragging mode.  This method sets the selection state based on the selection state from
     * when the drag started (longPress.selectedBefore).
     * @param to The tray that the pointer just entered, which triggered this listener
     */
    updateDragSelectionTo(to: Tray) {

        this.props.selected.forEach((_, tray) => { // reset selection
            this.props.selected.set(tray, this.state.longPress?.selectedBefore.get(tray) ?? false);
        });

        const xor: (a: boolean, b: boolean) => boolean = (a, b) => a ? !b : b;

        const from = this.state.longPress?.dragFrom;

        const boundIndices = {
            from: {
                column: -1,
                tray: -1
            },
            to: {
                column: -1,
                tray: -1
            }
        };

        // This block takes all the trays in the current shelf and sorts them into the order that the drag select uses.
        // After they have been sorted into any order, anything between the from and to trays is then marked as selected
        const trayOrdered = this.props.shelf.columns.flatMap((column, columnIndex) =>
            column.trays.map((tray: Tray, trayIndex) => {
                if (tray === from) {
                    boundIndices.from.column = columnIndex;
                    boundIndices.from.tray = trayIndex;
                }
                if (tray === to) {
                    boundIndices.to.column = columnIndex;
                    boundIndices.to.tray = trayIndex;
                }

                return { // this maps all trays to an object which contains the tray and relevant indices
                    columnIndex: columnIndex,
                    trayIndex: trayIndex,
                    tray: tray
                };
            })
        ).sort(((a, b) => {

            // this is a multi level sort

            if (a.columnIndex < b.columnIndex) return -1;
            if (a.columnIndex > b.columnIndex) return 1;

            // this invert makes sure that trays above the start tray are always selected
            // todo decide if this ordering is more logical

            // const invertColumns = boundIndices.from.column < boundIndices.to.column ? 1 : -1;
            // if (a.trayIndex < b.trayIndex) return 1 * invertColumns;
            // if (a.trayIndex > b.trayIndex) return -1 * invertColumns;

            return 0;
        })).map(it => it.tray);

        // now that the trays are ordered, this reduce (or fold) goes through in order and selects all trays between
        // the from and to trays
        trayOrdered.reduce((isSelecting, tray) => {

            const selectThis = isSelecting || tray === from || tray === to;

            if (selectThis) {
                this.props.selected.set(tray, true);
            }
            return xor(isSelecting, xor(tray === from, tray === to));

        }, false); // the accumulator of the fold is if the trays are still being selected

        this.forceUpdate(); // the state has been changed
    }

    /**
     * This method is called when a drag event is ended by pointer up, or when the pointer leaves the viewport during a
     * drag. After drag finishes and the state is set, the callback is to fix the UI select display mode
     */
    onDragSelectEnd() {

        this.setState({
            ...this.state,
            longPress: null,
        }, this.fixSelectDisplayMode);
    }

    /**
     * This method is called to fix the UI select display mode (whether in multiple-select mode), once the selection
     * has been updated. It's called after a click, or after a drag finishes.
     */
    fixSelectDisplayMode() {
        const currSelected = Array.from(this.props.selected.entries())
                                  .filter(([_, value]) => value);

        const multipleSelect = currSelected.length > 1;

        this.setState({
            ...this.state,
            multipleSelect: multipleSelect,
        }, this.forceUpdate);
    }

    /**
     * This method is called when a tray is clicked, a click being a higher level combination of onPointerDown and
     * onPointerUp.  This method controls the selecting behaviour of a singular tray.  Notably, this method is also
     * called after a pointer drag event if the event ends on the same tray as it started.
     * @param tray The tray that is clicked
     * @param e The react event object which triggered this listener
     */
    onTrayClick(tray: Tray, e: React.PointerEvent<HTMLDivElement>) {

        const currSelected = Array.from(this.props.selected.entries())
                                  .filter(([_, value]) => value);

        // If there's only one thing selected, and not in multiple select mode, and it's not the current thing, then
        // deselect that thing and just toggle this one as normal below
        if (currSelected.length === 1 && !this.state.multipleSelect) {
            if (tray !== currSelected[0][0]) {
                this.props.selected.set(currSelected[0][0], false);
            }
        }

        // Toggle the selection
        this.props.selected.set(tray, !this.props.selected.get(tray));
        // Fix the select display mode
        this.fixSelectDisplayMode();

    }

    /**
     * This method is called when the pointer is pressed over a tray, it begins the timeout which controls dragging
     * @param tray The tray on which the pointer is pressed
     * @param e The react pointer event that triggered this call
     */
    onTrayPointerDown(tray: Tray, e: React.PointerEvent<HTMLDivElement>) {
        e.currentTarget.releasePointerCapture(e.pointerId);
        const timeout: number = window.setTimeout(() => { // await hold time
            if (this.state.longPress) { // not interrupted
                this.onDragSelectStart();
            }
        }, LONG_PRESS_TIMEOUT);

        this.setState({
            ...this.state,
            longPress: {
                selectedBefore: new Map(),
                isHappening: false,
                timeout: timeout,
                dragFrom: tray
            }
        });
    }

    /**
     * This method is called when the pointer button is released over a tray, this either cancels the new drag event
     * timeout, finalises a current dragging event or performs a pointer click.
     * @param tray The tray over which the even is triggered
     * @param e The react pointer event that triggered this call
     */
    onTrayPointerUp(tray: Tray, e: React.PointerEvent<HTMLDivElement>) {

        if (this.state.longPress) {
            if (this.state.longPress.isHappening) {
                this.onDragSelectEnd(); // end of drag
            } else {
                window.clearTimeout(this.state.longPress?.timeout);
                this.setState({
                    ...this.state,
                    longPress: null
                });
                this.onTrayClick(tray, e);
            }
        }

    }

    /**
     * This method is called when the pointer leaves the DOM element which represents any tray.  This method stops a
     * pointer down event from starting a drag event if the pointer leaves that tray.
     * @param e The react pointer event that triggered this call
     */
    onTrayPointerLeave(e: React.PointerEvent<HTMLDivElement>) {

        if (this.state.longPress && !this.state.longPress.isHappening) {
            // is between pointer down and drag start
            window.clearTimeout(this.state.longPress?.timeout);

            this.setState({ // kills the long press
                ...this.state,
                longPress: null
            });
        }
    }

    /**
     * This method is called when the pointer enters the DOM element which represents a particular tray
     * @param tray The tray over which the pointer entered
     */
    onTrayPointerEnter(tray: Tray) {
        if (this.state.longPress?.isHappening) {
            this.updateDragSelectionTo(tray);
        }
    }

    /**
     * @inheritDoc
     */
    render() {

        return (
            <div id="viewPort" touch-action="none" onPointerLeave={this.onDragSelectEnd.bind(this)}>
                <div id="shelf">
                    {this.props.shelf.columns.map((column, columnIndex) =>
                        <div
                            style={{order: columnIndex}}
                            className="column"
                            key={columnIndex}
                        >
                            {column.trays.map((tray, trayIndex) =>

                                <div
                                    className={`tray${
                                        this.props.selected.get(tray) ? " selected" : ""}`}

                                    // onClick={this.onTrayClick.bind(this, tray)}
                                    onPointerDown={this.onTrayPointerDown.bind(this, tray)}
                                    onPointerEnter={this.onTrayPointerEnter.bind(this, tray)}
                                    onPointerLeave={this.onTrayPointerLeave.bind(this)}
                                    onPointerUp={this.onTrayPointerUp.bind(this, tray)}
                                    key={trayIndex}
                                >
                                    <FontAwesomeIcon
                                        className={`tray-tickbox ${this.state.multipleSelect ? " multiple-select"
                                                                                             : ""} ${this.props.selected.get(tray)
                                                                                                     ? "tick-selected"
                                                                                                     : "tick-unselected"}`}
                                        icon={tickSolid}/>
                                    <div className="trayCategory">{tray.category?.name ?? "Mixed"}</div>

                                    <div className="trayExpiry" style={{
                                        backgroundColor: tray.expiry?.color
                                    }}>{tray.expiry?.label ?? "?"}</div>

                                    <div className="trayWeight">{tray.weight ?? "?"}kg</div>

                                    <div className="trayCustomField">{tray.customField ?? ""}</div>
                                </div>)}
                        </div>)
                    }</div>
            </div>
        );
    }
}