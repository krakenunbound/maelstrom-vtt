import { useId, useState } from "react";
import { rulesetFor } from "../../shared/rulesets/registry.mjs";
import { FormattedText } from "../books/Records";
import { DropZone } from "../books/RecordEditor";
import type { QuickSlot, Session } from "../session/useSession";
import type { PartyView } from "./PartySheet";
import { Icon } from "../ui/icons";
import { slotDrag, useOpenLink } from "../ui/QuickSlots";

// The party sheet's Bastion tab (5E 2024; FG's ps_bastion): each member's bastion and its facilities, the order each
// is carrying out and the turns left. An order (one of the game's: Craft, Empower...) is dragged onto a facility, or
// chosen on it; the same order again is a turn more. A player manages their own character's bastion (names, adds and
// removes facilities, a record dropped in as one); the GM any, and clears orders, advances the bastion turn and
// keeps the log. The host's rules: electron/bastion.cjs.
type Facility = { name: string; order?: string; duration?: number; link?: QuickSlot };
type Bastion = { name?: string; facilities?: Record<string, Facility> };
const ORDER_DRAG = "application/x-kraken-bastion-order";

export function bastionsOn(session: Session) {
  const spec = rulesetFor(session.ruleset ?? "").bastion;
  return Boolean(spec && (!spec.rule || session.options.rules?.[spec.rule] === true));
}

export function BastionTab({ session, party }: { session: Session; party: PartyView }) {
  const gm = session.role === "dm";
  const spec = rulesetFor(session.ruleset ?? "").bastion;
  const orders = spec?.orders ?? [];
  const me = session.players.find((seat) => seat.id === session.selfId)?.name ?? "";
  const [status, setStatus] = useState("");
  const [log, setLog] = useState<{ turn: number; text: string } | null>(null);
  const [turn, setTurn] = useState("");
  const [over, setOver] = useState("");
  const openLink = useOpenLink(session);
  const own = useId();
  const act = (body: Record<string, unknown>) =>
    session
      .content<{ turn?: number; text?: string; log?: string }>("party-bastion", body)
      .then((result) => {
        setStatus("");
        return result;
      })
      .catch((error: unknown) => {
        setStatus(error instanceof Error ? error.message : "Could not do that.");
        return null;
      });
  const showLog = () => void act({ action: "log" }).then((result) => result && setLog({ turn: Number(result.turn) || 0, text: String(result.text ?? "") }));

  return (
    <div className="bastion-tab" data-bastion-tab="">
      <div className="bastion-orders" role="group" aria-label="Orders">
        <span className="hint">Orders</span>
        {orders.map((order) => (
          <span
            key={order}
            className="bastion-order"
            draggable
            data-bastion-order={order}
            title={`Drag ${order} onto a facility (again on the same facility: a turn more)`}
            onDragStart={(event) => {
              event.dataTransfer.setData(ORDER_DRAG, order);
              event.dataTransfer.effectAllowed = "copy";
            }}
          >
            {order}
          </span>
        ))}
        {gm ? (
          <span className="bastion-gm">
            <button type="button" data-action="bastion-advance" title="Advance the bastion turn: the log gets it, every order counts down a turn" onClick={() => void act({ action: "advance" }).then(() => log && showLog())}>
              <Icon name="next" size={15} /> Next turn
            </button>
            <button type="button" className="ghost" data-action="bastion-log" title="The bastion log" aria-pressed={Boolean(log)} onClick={() => (log ? setLog(null) : showLog())}>
              <Icon name="book" size={15} /> Log
            </button>
          </span>
        ) : null}
      </div>
      {gm && log ? (
        <section className="bastion-log" data-bastion-log="">
          <div className="cc-inline">
            <label htmlFor={`${own}-turn`}>Turn</label>
            <input id={`${own}-turn`} type="number" min={0} value={turn === "" ? log.turn : turn} onChange={(event) => setTurn(event.target.value)} onBlur={() => turn !== "" && void act({ action: "turn", turn: Number(turn) }).then(() => (setTurn(""), showLog()))} />
            <button type="button" className="ghost" data-action="bastion-log-clear" onClick={() => void act({ action: "log-clear" }).then(showLog)}>
              Clear the log
            </button>
          </div>
          {log.text ? <FormattedText text={log.text} /> : <p className="hint">No turns yet.</p>}
        </section>
      ) : null}
      {status ? (
        <p className="hint" role="status">
          {status}
        </p>
      ) : null}
      {party.members.length === 0 ? <p className="hint">The party has no members.</p> : null}
      {party.members.map((member) => {
        const record = session.records[member.id];
        const mine = gm || member.owner === me;
        const bastion: Bastion = (record?.data?.bastion as Bastion | undefined) ?? {};
        const facilities = Object.entries(bastion.facilities ?? {});
        const name = bastion.name || `${member.name} Bastion`;
        return (
          <section key={member.id} className="bastion-member" data-bastion-member={member.name}>
            <h4>
              {mine ? (
                <input
                  aria-label={`${member.name}'s bastion's name`}
                  defaultValue={name}
                  key={name}
                  onBlur={(event) => event.target.value.trim() && event.target.value.trim() !== name && void act({ action: "name", character: member.id, name: event.target.value })}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.nativeEvent.isComposing) event.currentTarget.blur();
                  }}
                />
              ) : (
                name
              )}
              <small className="hint"> {member.name}</small>
            </h4>
            {!record ? <p className="hint">Not yours to see.</p> : null}
            {record && facilities.length === 0 ? <p className="hint">No facilities yet.</p> : null}
            <ul className="bastion-facilities">
              {facilities.map(([key, facility]) => {
                const slot = `${member.id}/${key}`;
                return (
                  <li
                    key={key}
                    className={over === slot ? "bastion-facility over" : "bastion-facility"}
                    data-bastion-facility={facility.name}
                    onDragOver={(event) => {
                      if (!mine || !event.dataTransfer.types.includes(ORDER_DRAG)) return;
                      event.preventDefault();
                      setOver(slot);
                    }}
                    onDragLeave={() => setOver("")}
                    onDrop={(event) => {
                      const order = event.dataTransfer.getData(ORDER_DRAG);
                      setOver("");
                      if (!mine || !order) return;
                      event.preventDefault();
                      void act({ action: "order", character: member.id, facility: key, order });
                    }}
                  >
                    {facility.link ? (
                      <button type="button" className="records-name" title={`Open ${facility.name}`} onClick={() => openLink(facility.link!)} {...slotDrag(facility.link)}>
                        {facility.name}
                      </button>
                    ) : (
                      <span className="records-name">{facility.name}</span>
                    )}
                    {mine ? (
                      <select aria-label={`${facility.name}'s order`} value={facility.order ?? ""} onChange={(event) => event.target.value && void act({ action: "order", character: member.id, facility: key, order: event.target.value })} data-bastion-set={facility.name}>
                        <option value="">No order</option>
                        {orders.map((order) => (
                          <option key={order} value={order}>
                            {order}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="bastion-current">{facility.order || "No order"}</span>
                    )}
                    <span className="bastion-turns" title="Bastion turns left">
                      {facility.order ? `${facility.duration ?? 0} turn${facility.duration === 1 ? "" : "s"}` : ""}
                    </span>
                    {gm && facility.order ? (
                      <button type="button" className="ghost" title="Clear its order" aria-label={`Clear ${facility.name}'s order`} onClick={() => void act({ action: "clear", character: member.id, facility: key })}>
                        <Icon name="eraser" size={14} />
                      </button>
                    ) : (
                      <span aria-hidden="true" />
                    )}
                    {mine ? (
                      <button type="button" className="ghost" title="Take the facility out" aria-label={`Take ${facility.name} out`} onClick={() => void act({ action: "remove", character: member.id, facility: key })}>
                        <Icon name="trash" size={14} />
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            {mine && record ? (
              <DropZone label={`bastion-${member.id}`} accepts={(link) => link.kind === "record" && Boolean(session.records[link.record])} onLink={(link) => void act({ action: "add", character: member.id, link })}>
                <form
                  className="cc-inline bastion-add"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const input = event.currentTarget.elements.namedItem("facility") as HTMLInputElement;
                    if (!input.value.trim()) return;
                    void act({ action: "add", character: member.id, name: input.value }).then(() => (input.value = ""));
                  }}
                >
                  <label htmlFor={`${own}-${member.id}`} className="sr-only">
                    A new facility for {name}
                  </label>
                  <input id={`${own}-${member.id}`} name="facility" placeholder="New facility (or drop a location here)" maxLength={120} />
                  <button type="submit" title="Add the facility" aria-label="Add the facility">
                    <Icon name="plus" size={14} />
                  </button>
                </form>
              </DropZone>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
