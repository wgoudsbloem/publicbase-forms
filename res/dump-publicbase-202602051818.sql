--
-- PostgreSQL database dump
--

\restrict 9Dcft1mdwGrhDoVT0o3vlWHSaFJu41bCzKEyZfNMDQnONADDoa3gnsFF6oim6So

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.7 (Ubuntu 17.7-3.pgdg24.04+1)

-- Started on 2026-02-05 13:18:03 EST

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 8 (class 2615 OID 16440)
-- Name: publish; Type: SCHEMA; Schema: -; Owner: pbadmin
--

CREATE SCHEMA publish;


ALTER SCHEMA publish OWNER TO pbadmin;

--
-- TOC entry 900 (class 1247 OID 16730)
-- Name: submission_status; Type: TYPE; Schema: publish; Owner: pbadmin
--

CREATE TYPE publish.submission_status AS ENUM (
    'OPEN',
    'ASSIGNED',
    'PROCESSING',
    'PROCESSED',
    'APPROVED',
    'DENIED',
    'CLOSED',
    'DELETED'
);


ALTER TYPE publish.submission_status OWNER TO pbadmin;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 231 (class 1259 OID 16654)
-- Name: notification_type; Type: TABLE; Schema: publish; Owner: pbadmin
--

CREATE TABLE publish.notification_type (
    id text NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    "order" smallint NOT NULL,
    supports_results boolean DEFAULT false NOT NULL
);


ALTER TABLE publish.notification_type OWNER TO pbadmin;

--
-- TOC entry 232 (class 1259 OID 16661)
-- Name: notification_type_notifications; Type: TABLE; Schema: publish; Owner: pbadmin
--

CREATE TABLE publish.notification_type_notifications (
    notification_id uuid NOT NULL,
    notification_type text NOT NULL,
    include_results boolean DEFAULT false NOT NULL
);


ALTER TABLE publish.notification_type_notifications OWNER TO pbadmin;

--
-- TOC entry 230 (class 1259 OID 16639)
-- Name: notifications; Type: TABLE; Schema: publish; Owner: pbadmin
--

CREATE TABLE publish.notifications (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    form_id uuid NOT NULL
);


ALTER TABLE publish.notifications OWNER TO pbadmin;

--
-- TOC entry 233 (class 1259 OID 16750)
-- Name: statuses; Type: TABLE; Schema: publish; Owner: pbadmin
--

CREATE TABLE publish.statuses (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    status character varying DEFAULT 'OPEN'::character varying NOT NULL,
    submission_id uuid NOT NULL
);


ALTER TABLE publish.statuses OWNER TO pbadmin;

--
-- TOC entry 229 (class 1259 OID 16622)
-- Name: submissions; Type: TABLE; Schema: publish; Owner: pbadmin
--

CREATE TABLE publish.submissions (
    id uuid NOT NULL,
    form_id uuid NOT NULL,
    department_id uuid NOT NULL,
    data jsonb NOT NULL
);


ALTER TABLE publish.submissions OWNER TO pbadmin;

--
-- TOC entry 4374 (class 0 OID 16654)
-- Dependencies: 231
-- Data for Name: notification_type; Type: TABLE DATA; Schema: publish; Owner: pbadmin
--

COPY publish.notification_type (id, name, description, "order", supports_results) FROM stdin;
SMS	SMS Text	Receive a SMS text when a new submission has been received	30	f
EMAIL	Email	Receive an email when a new submission has been received	10	t
API	API	Notify the API endpoint	20	t
\.


--
-- TOC entry 4375 (class 0 OID 16661)
-- Dependencies: 232
-- Data for Name: notification_type_notifications; Type: TABLE DATA; Schema: publish; Owner: pbadmin
--

COPY publish.notification_type_notifications (notification_id, notification_type, include_results) FROM stdin;
\.


--
-- TOC entry 4373 (class 0 OID 16639)
-- Dependencies: 230
-- Data for Name: notifications; Type: TABLE DATA; Schema: publish; Owner: pbadmin
--

COPY publish.notifications (id, user_id, form_id) FROM stdin;
5fb1ae97-2991-4634-ac45-b4749a40c0ad	bc4d0518-e0a1-70e8-6bcc-c8909ec49408	f8554225-9316-4aee-9f53-04567c9d0999
\.


--
-- TOC entry 4376 (class 0 OID 16750)
-- Dependencies: 233
-- Data for Name: statuses; Type: TABLE DATA; Schema: publish; Owner: pbadmin
--

COPY publish.statuses (id, user_id, status, submission_id) FROM stdin;
\.


--
-- TOC entry 4372 (class 0 OID 16622)
-- Dependencies: 229
-- Data for Name: submissions; Type: TABLE DATA; Schema: publish; Owner: pbadmin
--

COPY publish.submissions (id, form_id, department_id, data) FROM stdin;
\.


--
-- TOC entry 4216 (class 2606 OID 16697)
-- Name: notification_type_notifications notification_type_notifications_pk; Type: CONSTRAINT; Schema: publish; Owner: pbadmin
--

ALTER TABLE ONLY publish.notification_type_notifications
    ADD CONSTRAINT notification_type_notifications_pk PRIMARY KEY (notification_id, notification_type);


--
-- TOC entry 4211 (class 2606 OID 16680)
-- Name: notification_type notification_type_pk; Type: CONSTRAINT; Schema: publish; Owner: pbadmin
--

ALTER TABLE ONLY publish.notification_type
    ADD CONSTRAINT notification_type_pk PRIMARY KEY (id);


--
-- TOC entry 4213 (class 2606 OID 16695)
-- Name: notification_type notification_type_unique; Type: CONSTRAINT; Schema: publish; Owner: pbadmin
--

ALTER TABLE ONLY publish.notification_type
    ADD CONSTRAINT notification_type_unique UNIQUE (id);


--
-- TOC entry 4209 (class 2606 OID 16643)
-- Name: notifications notifications_pk; Type: CONSTRAINT; Schema: publish; Owner: pbadmin
--

ALTER TABLE ONLY publish.notifications
    ADD CONSTRAINT notifications_pk PRIMARY KEY (id);


--
-- TOC entry 4218 (class 2606 OID 16757)
-- Name: statuses statuses_pk; Type: CONSTRAINT; Schema: publish; Owner: pbadmin
--

ALTER TABLE ONLY publish.statuses
    ADD CONSTRAINT statuses_pk PRIMARY KEY (id);


--
-- TOC entry 4207 (class 2606 OID 16628)
-- Name: submissions submissions_pk; Type: CONSTRAINT; Schema: publish; Owner: pbadmin
--

ALTER TABLE ONLY publish.submissions
    ADD CONSTRAINT submissions_pk PRIMARY KEY (id);


--
-- TOC entry 4214 (class 1259 OID 16674)
-- Name: notification_type_notifications_notification_id_idx; Type: INDEX; Schema: publish; Owner: pbadmin
--

CREATE INDEX notification_type_notifications_notification_id_idx ON publish.notification_type_notifications USING btree (notification_id);


--
-- TOC entry 4223 (class 2606 OID 16707)
-- Name: notification_type_notifications notification_type_notifications_notification_type_fk; Type: FK CONSTRAINT; Schema: publish; Owner: pbadmin
--

ALTER TABLE ONLY publish.notification_type_notifications
    ADD CONSTRAINT notification_type_notifications_notification_type_fk FOREIGN KEY (notification_type) REFERENCES publish.notification_type(id);


--
-- TOC entry 4224 (class 2606 OID 16689)
-- Name: notification_type_notifications notification_type_notifications_notifications_fk; Type: FK CONSTRAINT; Schema: publish; Owner: pbadmin
--

ALTER TABLE ONLY publish.notification_type_notifications
    ADD CONSTRAINT notification_type_notifications_notifications_fk FOREIGN KEY (notification_id) REFERENCES publish.notifications(id);


--
-- TOC entry 4221 (class 2606 OID 16649)
-- Name: notifications notifications_forms_fk; Type: FK CONSTRAINT; Schema: publish; Owner: pbadmin
--

ALTER TABLE ONLY publish.notifications
    ADD CONSTRAINT notifications_forms_fk FOREIGN KEY (form_id) REFERENCES forms.forms(id);


--
-- TOC entry 4222 (class 2606 OID 16644)
-- Name: notifications notifications_users_fk; Type: FK CONSTRAINT; Schema: publish; Owner: pbadmin
--

ALTER TABLE ONLY publish.notifications
    ADD CONSTRAINT notifications_users_fk FOREIGN KEY (user_id) REFERENCES orgs.users(id);


--
-- TOC entry 4225 (class 2606 OID 16763)
-- Name: statuses statuses_submissions_fk; Type: FK CONSTRAINT; Schema: publish; Owner: pbadmin
--

ALTER TABLE ONLY publish.statuses
    ADD CONSTRAINT statuses_submissions_fk FOREIGN KEY (submission_id) REFERENCES publish.submissions(id);


--
-- TOC entry 4226 (class 2606 OID 16758)
-- Name: statuses statuses_users_fk; Type: FK CONSTRAINT; Schema: publish; Owner: pbadmin
--

ALTER TABLE ONLY publish.statuses
    ADD CONSTRAINT statuses_users_fk FOREIGN KEY (user_id) REFERENCES orgs.users(id);


--
-- TOC entry 4219 (class 2606 OID 16634)
-- Name: submissions submissions_departments_fk; Type: FK CONSTRAINT; Schema: publish; Owner: pbadmin
--

ALTER TABLE ONLY publish.submissions
    ADD CONSTRAINT submissions_departments_fk FOREIGN KEY (department_id) REFERENCES orgs.departments(id) ON UPDATE CASCADE;


--
-- TOC entry 4220 (class 2606 OID 16629)
-- Name: submissions submissions_forms_fk; Type: FK CONSTRAINT; Schema: publish; Owner: pbadmin
--

ALTER TABLE ONLY publish.submissions
    ADD CONSTRAINT submissions_forms_fk FOREIGN KEY (form_id) REFERENCES forms.forms(id);


-- Completed on 2026-02-05 13:18:07 EST

--
-- PostgreSQL database dump complete
--

\unrestrict 9Dcft1mdwGrhDoVT0o3vlWHSaFJu41bCzKEyZfNMDQnONADDoa3gnsFF6oim6So

