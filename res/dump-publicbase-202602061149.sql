--
-- PostgreSQL database dump
--

\restrict 1po5nf7yXXKEZQ0Hr177A132XG7owdaB9hcD6RkPCIlLwajhMbtTJgBVQq5KEzS

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.7 (Ubuntu 17.7-3.pgdg24.04+1)

-- Started on 2026-02-06 06:49:37 EST

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
-- TOC entry 8 (class 2615 OID 16437)
-- Name: forms; Type: SCHEMA; Schema: -; Owner: pbadmin
--

CREATE SCHEMA forms;


ALTER SCHEMA forms OWNER TO pbadmin;

--
-- TOC entry 6 (class 2615 OID 16438)
-- Name: orgs; Type: SCHEMA; Schema: -; Owner: pbadmin
--

CREATE SCHEMA orgs;


ALTER SCHEMA orgs OWNER TO pbadmin;

--
-- TOC entry 7 (class 2615 OID 16440)
-- Name: publish; Type: SCHEMA; Schema: -; Owner: pbadmin
--

CREATE SCHEMA publish;


ALTER SCHEMA publish OWNER TO pbadmin;

--
-- TOC entry 864 (class 1247 OID 16442)
-- Name: form_status; Type: TYPE; Schema: forms; Owner: pbadmin
--

CREATE TYPE forms.form_status AS ENUM (
    'DRAFT',
    'PENDING',
    'APPROVED',
    'REJECTED',
    'PUBLISHED',
    'DELETED'
);


ALTER TYPE forms.form_status OWNER TO pbadmin;

--
-- TOC entry 867 (class 1247 OID 16456)
-- Name: phone_type; Type: TYPE; Schema: orgs; Owner: pbadmin
--

CREATE TYPE orgs.phone_type AS ENUM (
    'LAND_LINE',
    'MOBILE'
);


ALTER TYPE orgs.phone_type OWNER TO pbadmin;

--
-- TOC entry 870 (class 1247 OID 16462)
-- Name: user_status; Type: TYPE; Schema: orgs; Owner: pbadmin
--

CREATE TYPE orgs.user_status AS ENUM (
    'ACTIVE',
    'INACTIVE',
    'DELETED'
);


ALTER TYPE orgs.user_status OWNER TO pbadmin;

--
-- TOC entry 912 (class 1247 OID 16730)
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

--
-- TOC entry 234 (class 1255 OID 16469)
-- Name: set_updated_at(); Type: FUNCTION; Schema: forms; Owner: pbadmin
--

CREATE FUNCTION forms.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Only set updated_at if the column exists in the table
  -- and the row is actually being updated.
  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION forms.set_updated_at() OWNER TO pbadmin;

--
-- TOC entry 235 (class 1255 OID 16470)
-- Name: set_updated_at(); Type: FUNCTION; Schema: orgs; Owner: pbadmin
--

CREATE FUNCTION orgs.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Only set updated_at if the column exists in the table
  -- and the row is actually being updated.
  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION orgs.set_updated_at() OWNER TO pbadmin;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 220 (class 1259 OID 16471)
-- Name: forms; Type: TABLE; Schema: forms; Owner: pbadmin
--

CREATE TABLE forms.forms (
    id uuid NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    department_id uuid NOT NULL,
    user_id uuid,
    schema jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    public_url text,
    s3_url text,
    code text
);


ALTER TABLE forms.forms OWNER TO pbadmin;

--
-- TOC entry 221 (class 1259 OID 16478)
-- Name: statuses; Type: TABLE; Schema: forms; Owner: pbadmin
--

CREATE TABLE forms.statuses (
    id uuid NOT NULL,
    form_id uuid NOT NULL,
    user_id uuid NOT NULL,
    form_status forms.form_status NOT NULL,
    comment text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE forms.statuses OWNER TO pbadmin;

--
-- TOC entry 222 (class 1259 OID 16485)
-- Name: templates; Type: TABLE; Schema: forms; Owner: pbadmin
--

CREATE TABLE forms.templates (
    id uuid NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    department_id uuid,
    organization_id uuid,
    user_id uuid,
    schema jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE forms.templates OWNER TO pbadmin;

--
-- TOC entry 223 (class 1259 OID 16492)
-- Name: departments; Type: TABLE; Schema: orgs; Owner: pbadmin
--

CREATE TABLE orgs.departments (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE orgs.departments OWNER TO pbadmin;

--
-- TOC entry 224 (class 1259 OID 16499)
-- Name: organizations; Type: TABLE; Schema: orgs; Owner: pbadmin
--

CREATE TABLE orgs.organizations (
    id uuid NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    country_state character varying(6) NOT NULL
);


ALTER TABLE orgs.organizations OWNER TO pbadmin;

--
-- TOC entry 225 (class 1259 OID 16506)
-- Name: roles; Type: TABLE; Schema: orgs; Owner: pbadmin
--

CREATE TABLE orgs.roles (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE orgs.roles OWNER TO pbadmin;

--
-- TOC entry 226 (class 1259 OID 16513)
-- Name: users; Type: TABLE; Schema: orgs; Owner: pbadmin
--

CREATE TABLE orgs.users (
    id uuid NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    email text NOT NULL,
    phone text,
    phone_type orgs.phone_type,
    status orgs.user_status DEFAULT 'ACTIVE'::orgs.user_status NOT NULL
);


ALTER TABLE orgs.users OWNER TO pbadmin;

--
-- TOC entry 227 (class 1259 OID 16521)
-- Name: users_departments; Type: TABLE; Schema: orgs; Owner: pbadmin
--

CREATE TABLE orgs.users_departments (
    user_id uuid NOT NULL,
    department_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE orgs.users_departments OWNER TO pbadmin;

--
-- TOC entry 228 (class 1259 OID 16526)
-- Name: users_roles; Type: TABLE; Schema: orgs; Owner: pbadmin
--

CREATE TABLE orgs.users_roles (
    user_id uuid NOT NULL,
    roles_id text NOT NULL
);


ALTER TABLE orgs.users_roles OWNER TO pbadmin;

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
    data jsonb NOT NULL
);


ALTER TABLE publish.submissions OWNER TO pbadmin;

--
-- TOC entry 4440 (class 0 OID 16471)
-- Dependencies: 220
-- Data for Name: forms; Type: TABLE DATA; Schema: forms; Owner: pbadmin
--

COPY forms.forms (id, name, description, department_id, user_id, schema, created_at, updated_at, public_url, s3_url, code) FROM stdin;
a3b9cc7e-f804-48e0-a590-8ddbd1a3d22e	Building License Application	Apply for a residential or commercial building license.	245fe4b4-8173-4b92-97c9-b8db1c3513c1	0c3da5d8-f011-7079-3dbf-33597d3dd94a	{"form": {"id": "a3b9cc7e-f804-48e0-a590-8ddbd1a3d22e", "title": "Building License Application", "templateId": "caf852c6-4711-4725-9078-70459bf95b15", "description": "Apply for a residential or commercial building license."}, "fields": [{"name": "applicant_full_name", "type": "text", "label": "Applicant Full Name", "required": true, "placeholder": "Jane Doe", "defaultValue": ""}, {"name": "applicant_email", "type": "email", "label": "Applicant Email", "required": true, "placeholder": "jane@example.com", "defaultValue": ""}, {"name": "applicant_phone", "type": "text", "label": "Applicant Phone", "required": true, "placeholder": "555-123-4567", "defaultValue": ""}, {"name": "property_address", "type": "textarea", "label": "Property Address", "required": true, "placeholder": "123 Main St, Springfield", "defaultValue": ""}, {"name": "project_type", "type": "select", "label": "Project Type", "options": ["New construction", "Renovation", "Addition", "Demolition"], "required": true, "placeholder": "Select project type", "defaultValue": ""}, {"name": "property_type", "type": "radio", "label": "Property Type", "options": ["Residential", "Commercial", "Industrial"], "required": true, "placeholder": "", "defaultValue": ""}, {"name": "estimated_project_cost", "type": "currency", "label": "Estimated Project Cost (USD)", "required": true, "placeholder": "0.00", "defaultValue": ""}, {"name": "estimated_start_date", "type": "date", "label": "Estimated Start Date", "required": true, "placeholder": "", "defaultValue": ""}, {"max": 36, "min": 1, "name": "estimated_completion_months", "type": "number", "label": "Estimated Completion (months)", "required": false, "placeholder": "6", "defaultValue": ""}, {"name": "contractor_name", "type": "text", "label": "Licensed Contractor Name", "required": false, "placeholder": "ABC Construction Ltd.", "defaultValue": ""}, {"name": "contractor_license_number", "type": "text", "label": "Contractor License Number", "required": false, "placeholder": "LIC-123456", "defaultValue": ""}, {"name": "project_description", "type": "textarea", "label": "Project Description", "required": true, "placeholder": "Describe the scope of work.", "defaultValue": ""}, {"name": "documents_attached", "type": "checkbox", "label": "Required Documents Attached", "required": true, "placeholder": "I confirm required documents are attached", "defaultValue": "false"}, {"name": "notice", "type": "static", "label": "Notice", "content": "<p>Applications are reviewed within 10 business days. Additional inspections may be required.</p>", "required": false, "placeholder": "", "defaultValue": ""}]}	2026-01-24 16:14:13.196515+00	2026-01-24 16:14:13.196515+00	\N	\N	\N
82859c55-4339-4bfe-a8ce-5c499a5ff858	Small Building License Application 2	Apply for a residential or commercial building license.	245fe4b4-8173-4b92-97c9-b8db1c3513c1	0c3da5d8-f011-7079-3dbf-33597d3dd94a	{"form": {"id": "82859c55-4339-4bfe-a8ce-5c499a5ff858", "title": "Small Building License Application 2", "templateId": "caf852c6-4711-4725-9078-70459bf95b15", "description": "Apply for a residential or commercial building license."}, "fields": [{"name": "applicant_full_name", "type": "text", "label": "Applicant Full Name", "required": true, "placeholder": "Jane Doe", "defaultValue": ""}, {"name": "applicant_email", "type": "email", "label": "Applicant Email", "required": true, "placeholder": "jane@example.com", "defaultValue": ""}, {"name": "applicant_phone", "type": "text", "label": "Applicant Phone", "required": true, "placeholder": "555-123-4567", "defaultValue": ""}, {"name": "property_address", "type": "textarea", "label": "Property Address", "required": true, "placeholder": "123 Main St, Springfield", "defaultValue": ""}, {"name": "project_type", "type": "select", "label": "Project Type", "options": ["New construction", "Renovation", "Addition", "Demolition"], "required": true, "placeholder": "Select project type", "defaultValue": ""}, {"name": "property_type", "type": "radio", "label": "Property Type", "options": ["Residential", "Commercial", "Industrial"], "required": true, "placeholder": "", "defaultValue": ""}, {"name": "estimated_project_cost", "type": "currency", "label": "Estimated Project Cost (USD)", "required": true, "placeholder": "0.00", "defaultValue": ""}, {"name": "estimated_start_date", "type": "date", "label": "Estimated Start Date", "required": true, "placeholder": "", "defaultValue": ""}, {"max": 36, "min": 1, "name": "estimated_completion_months", "type": "number", "label": "Estimated Completion (months)", "required": false, "placeholder": "6", "defaultValue": ""}, {"name": "contractor_name", "type": "text", "label": "Licensed Contractor Name", "required": false, "placeholder": "ABC Construction Ltd.", "defaultValue": ""}, {"name": "contractor_license_number", "type": "text", "label": "Contractor License Number", "required": false, "placeholder": "LIC-123456", "defaultValue": ""}, {"name": "project_description", "type": "textarea", "label": "Project Description", "required": true, "placeholder": "Describe the scope of work.", "defaultValue": ""}, {"name": "documents_attached", "type": "checkbox", "label": "Required Documents Attached", "required": true, "placeholder": "I confirm required documents are attached", "defaultValue": "false"}, {"name": "notice", "type": "static", "label": "Notice", "content": "<p>Applications are reviewed within 10 business days. Additional inspections may be required.</p>", "required": false, "placeholder": "", "defaultValue": ""}]}	2026-01-24 16:37:38.037827+00	2026-01-25 17:20:10.257825+00	\N	\N	\N
850b52e3-6572-473c-b102-6b16cd700a13	Building License Application 3	Apply for a residential or commercial building license.	245fe4b4-8173-4b92-97c9-b8db1c3513c1	0c3da5d8-f011-7079-3dbf-33597d3dd94a	{"form": {"id": "850b52e3-6572-473c-b102-6b16cd700a13", "title": "Building License Application 3", "templateId": "caf852c6-4711-4725-9078-70459bf95b15", "description": "Apply for a residential or commercial building license."}, "fields": [{"name": "applicant_full_name", "type": "text", "label": "Applicant Full Name", "required": true, "placeholder": "Jane Doe", "defaultValue": ""}, {"name": "applicant_email", "type": "email", "label": "Applicant Email", "required": true, "placeholder": "jane@example.com", "defaultValue": ""}, {"name": "applicant_phone", "type": "text", "label": "Applicant Phone", "required": true, "placeholder": "555-123-4567", "defaultValue": ""}, {"name": "property_address", "type": "textarea", "label": "Property Address", "required": true, "placeholder": "123 Main St, Springfield", "defaultValue": ""}, {"name": "project_type", "type": "select", "label": "Project Type", "options": ["New construction", "Renovation", "Addition", "Demolition"], "required": true, "placeholder": "Select project type", "defaultValue": ""}, {"name": "property_type", "type": "radio", "label": "Property Type", "options": ["Residential", "Commercial", "Industrial"], "required": true, "placeholder": "", "defaultValue": ""}, {"name": "estimated_project_cost", "type": "currency", "label": "Estimated Project Cost (USD)", "required": true, "placeholder": "0.00", "defaultValue": ""}, {"name": "estimated_start_date", "type": "date", "label": "Estimated Start Date", "required": true, "placeholder": "", "defaultValue": ""}, {"max": 36, "min": 1, "name": "estimated_completion_months", "type": "number", "label": "Estimated Completion (months)", "required": false, "placeholder": "6", "defaultValue": ""}, {"name": "contractor_name", "type": "text", "label": "Licensed Contractor Name", "required": false, "placeholder": "ABC Construction Ltd.", "defaultValue": ""}, {"name": "contractor_license_number", "type": "text", "label": "Contractor License Number", "required": false, "placeholder": "LIC-123456", "defaultValue": ""}, {"name": "project_description", "type": "textarea", "label": "Project Description", "required": true, "placeholder": "Describe the scope of work.", "defaultValue": ""}, {"name": "documents_attached", "type": "checkbox", "label": "Required Documents Attached", "required": true, "placeholder": "I confirm required documents are attached", "defaultValue": "false"}, {"name": "notice", "type": "static", "label": "Notice", "content": "<p>Applications are reviewed within 10 business days. Additional inspections may be required.</p>", "required": false, "placeholder": "", "defaultValue": ""}]}	2026-01-26 12:27:34.849707+00	2026-01-26 12:27:34.849707+00	\N	\N	\N
4c408ae8-19b2-4b75-9496-96eb18e3097c	Pet License Application 4	Submit your pet information to apply for a local pet license.	245fe4b4-8173-4b92-97c9-b8db1c3513c1	1c4d8538-0041-702d-df81-6f23b7f4ec67	{"form": {"id": "4c408ae8-19b2-4b75-9496-96eb18e3097c", "title": "Pet License Application 4", "templateId": "9d261e60-c34b-4db5-a0f8-10ba6a6f9c91", "description": "Submit your pet information to apply for a local pet license."}, "fields": [{"name": "owner_full_name", "type": "text", "label": "Owner full name", "required": true, "placeholder": "Jane Doe", "defaultValue": ""}, {"name": "email", "type": "email", "label": "Email", "required": true, "placeholder": "you@example.com", "defaultValue": ""}, {"name": "phone_number", "type": "text", "label": "Phone number", "required": true, "placeholder": "(555) 123-4567", "defaultValue": ""}, {"name": "pet_name", "type": "text", "label": "Pet name", "required": true, "placeholder": "Luna", "defaultValue": ""}, {"name": "species", "type": "select", "label": "Species", "options": ["Dog", "Cat"], "required": true, "placeholder": "", "defaultValue": ""}, {"name": "breed", "type": "text", "label": "Breed", "required": false, "placeholder": "Labrador, Siamese, Mixed", "defaultValue": ""}, {"max": 40, "min": 0, "name": "age_years", "type": "number", "label": "Age (years)", "required": false, "placeholder": "3", "defaultValue": ""}, {"name": "spayed_neutered", "type": "radio", "label": "Spayed/Neutered", "options": ["Yes", "No"], "required": true, "placeholder": "", "defaultValue": ""}, {"name": "microchip_id", "type": "text", "label": "Microchip ID", "required": false, "placeholder": "Optional", "defaultValue": ""}, {"name": "emergency_contact", "type": "text", "label": "Emergency contact", "required": false, "placeholder": "Name and phone", "defaultValue": ""}]}	2026-01-26 13:41:17.174925+00	2026-01-26 13:41:17.174925+00	\N	\N	\N
1a3ca221-7698-4d04-a5ff-9c820eb22e6a	Pet License Application	Submit your pet information to apply for a local pet license.	245fe4b4-8173-4b92-97c9-b8db1c3513c1	0c3da5d8-f011-7079-3dbf-33597d3dd94a	{"form": {"id": "1a3ca221-7698-4d04-a5ff-9c820eb22e6a", "title": "Pet License Application", "templateId": "9d261e60-c34b-4db5-a0f8-10ba6a6f9c91", "description": "Submit your pet information to apply for a local pet license."}, "fields": [{"name": "owner_full_name", "type": "text", "label": "Owner full name", "required": true, "placeholder": "Joe Does", "defaultValue": ""}, {"name": "email", "type": "email", "label": "Email", "required": true, "placeholder": "you@example.com", "defaultValue": ""}, {"name": "phone_number", "type": "text", "label": "Phone number", "required": true, "placeholder": "(555) 123-4567", "defaultValue": ""}, {"name": "pet_name", "type": "text", "label": "Pet name", "required": true, "placeholder": "Luna", "defaultValue": ""}, {"name": "species", "type": "select", "label": "Species", "options": ["Dog", "Cat"], "required": true, "placeholder": "", "defaultValue": ""}, {"name": "breed", "type": "text", "label": "Breed", "required": false, "placeholder": "Labrador, Siamese, Mixed", "defaultValue": ""}, {"max": 40, "min": 0, "name": "age_years", "type": "number", "label": "Age (years)", "required": false, "placeholder": "3", "defaultValue": ""}, {"name": "spayed_neutered", "type": "radio", "label": "Spayed/Neutered", "options": ["Yes", "No"], "required": true, "placeholder": "", "defaultValue": ""}, {"name": "microchip_id", "type": "text", "label": "Microchip ID", "required": false, "placeholder": "Optional", "defaultValue": ""}, {"name": "emergency_contact", "type": "text", "label": "Emergency contact", "required": false, "placeholder": "Name and phone", "defaultValue": ""}]}	2026-01-22 17:10:34.960234+00	2026-01-26 14:06:55.563214+00	\N	\N	\N
5f21bcb3-7f98-4baa-afac-5f27b8bae9c9	Pet License Application 3	Submit your pet information to apply for a local pet license.	245fe4b4-8173-4b92-97c9-b8db1c3513c1	1c4d8538-0041-702d-df81-6f23b7f4ec67	{"form": {"id": "5f21bcb3-7f98-4baa-afac-5f27b8bae9c9", "title": "Pet License Application 3", "templateId": "9d261e60-c34b-4db5-a0f8-10ba6a6f9c91", "description": "Submit your pet information to apply for a local pet license."}, "fields": [{"name": "owner_full_name", "type": "text", "label": "Owner full name", "required": true, "placeholder": "Jane Doe", "defaultValue": ""}, {"name": "email", "type": "email", "label": "Email", "required": true, "placeholder": "you@example.com", "defaultValue": ""}, {"name": "phone_number", "type": "text", "label": "Phone number", "required": true, "placeholder": "(555) 123-4567", "defaultValue": ""}, {"name": "pet_name", "type": "text", "label": "Pet name", "required": true, "placeholder": "Luna", "defaultValue": ""}, {"name": "species", "type": "select", "label": "Species", "options": ["Dog", "Cat"], "required": true, "placeholder": "", "defaultValue": ""}, {"name": "breed", "type": "text", "label": "Breed", "required": false, "placeholder": "Labrador, Siamese, Mixed", "defaultValue": ""}, {"max": 40, "min": 0, "name": "age_years", "type": "number", "label": "Age (years)", "required": false, "placeholder": "3", "defaultValue": ""}, {"name": "spayed_neutered", "type": "radio", "label": "Spayed/Neutered", "options": ["Yes", "No"], "required": true, "placeholder": "", "defaultValue": ""}, {"name": "microchip_id", "type": "text", "label": "Microchip ID", "required": false, "placeholder": "Optional", "defaultValue": ""}, {"name": "emergency_contact", "type": "text", "label": "Emergency contact", "required": false, "placeholder": "Name and phone", "defaultValue": ""}]}	2026-01-26 13:36:47.116885+00	2026-01-28 12:05:50.505986+00	\N	\N	\N
643de53a-a3cb-4aae-a3fe-ed9afc5bd42a	My Pet License 44	Submit your pet information to apply for a local pet license.	245fe4b4-8173-4b92-97c9-b8db1c3513c1	0c3da5d8-f011-7079-3dbf-33597d3dd94a	{"form": {"id": "643de53a-a3cb-4aae-a3fe-ed9afc5bd42a", "title": "My Pet License 44", "templateId": "9d261e60-c34b-4db5-a0f8-10ba6a6f9c91", "description": "Submit your pet information to apply for a local pet license."}, "fields": [{"name": "owner_full_namo", "type": "text", "label": "Owner full namo", "required": true, "placeholder": "Jane Doe", "defaultValue": ""}, {"name": "email", "type": "email", "label": "Email", "required": true, "placeholder": "you@example.com", "defaultValue": ""}, {"name": "phone_number", "type": "text", "label": "Phone number", "required": true, "placeholder": "(555) 123-4567", "defaultValue": ""}, {"name": "pet_name", "type": "text", "label": "Pet name", "required": true, "placeholder": "Luna", "defaultValue": ""}, {"name": "species", "type": "select", "label": "Species", "options": ["Dog", "Cat"], "required": true, "placeholder": "", "defaultValue": ""}, {"name": "breed", "type": "text", "label": "Breed", "required": false, "placeholder": "Labrador, Siamese, Mixed", "defaultValue": ""}, {"max": 40, "min": 0, "name": "age_years", "type": "number", "label": "Age (years)", "required": false, "placeholder": "3", "defaultValue": ""}, {"name": "spayed_neutered", "type": "radio", "label": "Spayed/Neutered", "options": ["Yes", "No"], "required": true, "placeholder": "", "defaultValue": ""}, {"name": "microchip_id", "type": "text", "label": "Microchip ID", "required": false, "placeholder": "Optional", "defaultValue": ""}, {"name": "emergency_contact", "type": "text", "label": "Emergency contact", "required": false, "placeholder": "Name and phone", "defaultValue": ""}]}	2026-01-29 13:45:45.225868+00	2026-01-29 13:45:45.225868+00	\N	\N	\N
71ab911b-aa2d-49d6-be90-12ffac760b2e	Customer intake	some text here	245fe4b4-8173-4b92-97c9-b8db1c3513c1	0c3da5d8-f011-7079-3dbf-33597d3dd94a	{"form": {"id": "71ab911b-aa2d-49d6-be90-12ffac760b2e", "title": "Customer intake", "description": "some text here"}, "fields": [{"name": "name", "type": "text", "label": "Name", "required": true, "placeholder": "", "defaultValue": ""}]}	2026-01-29 20:10:11.511128+00	2026-01-29 20:10:11.511128+00	\N	\N	\N
f8554225-9316-4aee-9f53-04567c9d0999	Pet License Application 2	Submit your pet information to apply for a local pet license.	245fe4b4-8173-4b92-97c9-b8db1c3513c1	1c4d8538-0041-702d-df81-6f23b7f4ec67	{"form": {"id": "f8554225-9316-4aee-9f53-04567c9d0999", "title": "Pet License Application 2", "templateId": "9d261e60-c34b-4db5-a0f8-10ba6a6f9c91", "description": "Submit your pet information to apply for a local pet license."}, "fields": [{"name": "owner_full_name", "type": "text", "label": "Owner full name", "required": true, "placeholder": "Jane Doe", "defaultValue": ""}, {"name": "email", "type": "email", "label": "Email", "required": true, "placeholder": "you@example.com", "defaultValue": ""}, {"name": "phone_number", "type": "text", "label": "Phone number", "required": true, "placeholder": "(555) 123-4567", "defaultValue": ""}, {"name": "pet_name", "type": "text", "label": "Pet name", "required": true, "placeholder": "Luna", "defaultValue": ""}, {"name": "species", "type": "select", "label": "Species", "options": ["Dog", "Cat"], "required": true, "placeholder": "", "defaultValue": ""}, {"name": "breed", "type": "text", "label": "Breed", "required": false, "placeholder": "Labrador, Siamese, Mixed", "defaultValue": ""}, {"max": 40, "min": 0, "name": "age_years", "type": "number", "label": "Age (years)", "required": false, "placeholder": "3", "defaultValue": ""}, {"name": "spayed_neutered", "type": "radio", "label": "Spayed/Neutered", "options": ["Yes", "No"], "required": true, "placeholder": "", "defaultValue": ""}, {"name": "microchip_id", "type": "text", "label": "Microchip ID", "required": false, "placeholder": "Optional", "defaultValue": ""}, {"name": "emergency_contact", "type": "text", "label": "Emergency contact", "required": false, "placeholder": "Name and phone", "defaultValue": ""}]}	2026-01-26 13:36:29.614022+00	2026-02-03 21:40:22.793791+00	https://forms.publicbase.com/ca/on/twin_peaks/pet_license_application_2/2255/	s3://forms.publicbase.com/ca/on/twin_peaks/pet_license_application_2/2255/	2255
\.


--
-- TOC entry 4441 (class 0 OID 16478)
-- Dependencies: 221
-- Data for Name: statuses; Type: TABLE DATA; Schema: forms; Owner: pbadmin
--

COPY forms.statuses (id, form_id, user_id, form_status, comment, created_at, updated_at) FROM stdin;
e381a8c4-6fea-4325-9b95-e995b312e027	1a3ca221-7698-4d04-a5ff-9c820eb22e6a	0c3da5d8-f011-7079-3dbf-33597d3dd94a	DRAFT		2026-01-22 17:10:34.960234+00	2026-01-22 17:10:34.960234+00
6e185ad8-f201-4993-9e16-04e04dd77aa3	1a3ca221-7698-4d04-a5ff-9c820eb22e6a	0c3da5d8-f011-7079-3dbf-33597d3dd94a	PENDING		2026-01-22 17:10:50.161795+00	2026-01-22 17:10:50.161795+00
fe2b4d13-39a4-4b82-99c7-b38197ec3bcf	1a3ca221-7698-4d04-a5ff-9c820eb22e6a	0c3da5d8-f011-7079-3dbf-33597d3dd94a	REJECTED	<div>not good</div>	2026-01-22 17:28:20.089679+00	2026-01-22 17:28:20.089679+00
d6986539-0fd9-4488-b285-f6db146cb10b	1a3ca221-7698-4d04-a5ff-9c820eb22e6a	0c3da5d8-f011-7079-3dbf-33597d3dd94a	APPROVED	Approved by John Mayer.	2026-01-22 17:34:51.743892+00	2026-01-22 17:34:51.743892+00
4cc0c139-20e6-45d9-aee3-44044be22dc4	1a3ca221-7698-4d04-a5ff-9c820eb22e6a	0c3da5d8-f011-7079-3dbf-33597d3dd94a	DRAFT		2026-01-23 02:49:43.589912+00	2026-01-23 02:49:43.589912+00
9d4fe404-91cb-47df-9c86-cdf1c1e73d13	1a3ca221-7698-4d04-a5ff-9c820eb22e6a	0c3da5d8-f011-7079-3dbf-33597d3dd94a	PENDING		2026-01-23 02:49:55.490734+00	2026-01-23 02:49:55.490734+00
a05517d3-6bd6-4745-8326-fe27caee672c	1a3ca221-7698-4d04-a5ff-9c820eb22e6a	0c3da5d8-f011-7079-3dbf-33597d3dd94a	REJECTED	<div>this is not <b>good</b></div>	2026-01-23 02:50:33.051325+00	2026-01-23 02:50:33.051325+00
c8d67272-c4db-418f-85cb-e69692180b51	1a3ca221-7698-4d04-a5ff-9c820eb22e6a	0c3da5d8-f011-7079-3dbf-33597d3dd94a	DRAFT		2026-01-23 15:34:05.922493+00	2026-01-23 15:34:05.922493+00
dba061cc-807e-4d24-b91b-76f474537e2f	1a3ca221-7698-4d04-a5ff-9c820eb22e6a	0c3da5d8-f011-7079-3dbf-33597d3dd94a	PENDING		2026-01-23 15:34:10.893603+00	2026-01-23 15:34:10.893603+00
2494e4a5-ac34-4eba-b80c-539ddb1fbf1a	1a3ca221-7698-4d04-a5ff-9c820eb22e6a	bc4d0518-e0a1-70e8-6bcc-c8909ec49408	REJECTED	<div>let reject <b>this</b></div>	2026-01-24 13:17:47.090732+00	2026-01-24 13:17:47.090732+00
a6aab4a2-7078-467c-9b17-d84deef99074	1a3ca221-7698-4d04-a5ff-9c820eb22e6a	0c3da5d8-f011-7079-3dbf-33597d3dd94a	DRAFT		2026-01-24 14:39:58.820083+00	2026-01-24 14:39:58.820083+00
56f3415e-85d3-4944-bc02-28d3dfefced2	1a3ca221-7698-4d04-a5ff-9c820eb22e6a	0c3da5d8-f011-7079-3dbf-33597d3dd94a	DRAFT		2026-01-24 16:13:48.618392+00	2026-01-24 16:13:48.618392+00
02a08b2c-189f-47cc-93c0-147de286ed73	a3b9cc7e-f804-48e0-a590-8ddbd1a3d22e	0c3da5d8-f011-7079-3dbf-33597d3dd94a	DRAFT		2026-01-24 16:14:13.196515+00	2026-01-24 16:14:13.196515+00
04a7297b-c8d1-493a-9a2d-edc4c9eae8a8	a3b9cc7e-f804-48e0-a590-8ddbd1a3d22e	0c3da5d8-f011-7079-3dbf-33597d3dd94a	PENDING		2026-01-24 16:18:52.542176+00	2026-01-24 16:18:52.542176+00
20761a12-d0c0-473d-a8a2-1abbdcee38d9	82859c55-4339-4bfe-a8ce-5c499a5ff858	0c3da5d8-f011-7079-3dbf-33597d3dd94a	DRAFT		2026-01-24 16:37:38.037827+00	2026-01-24 16:37:38.037827+00
7a5b18fd-bb9a-4e47-877c-dc256c47b09c	82859c55-4339-4bfe-a8ce-5c499a5ff858	0c3da5d8-f011-7079-3dbf-33597d3dd94a	PENDING		2026-01-24 16:37:42.692477+00	2026-01-24 16:37:42.692477+00
bf61b547-173d-4060-ac62-acd30cae9d10	82859c55-4339-4bfe-a8ce-5c499a5ff858	bc4d0518-e0a1-70e8-6bcc-c8909ec49408	REJECTED	<div>This is not<b> good</b></div>	2026-01-24 16:38:40.337056+00	2026-01-24 16:38:40.337056+00
163b7e85-ec51-49c2-98b5-c2aed901a283	a3b9cc7e-f804-48e0-a590-8ddbd1a3d22e	bc4d0518-e0a1-70e8-6bcc-c8909ec49408	APPROVED		2026-01-24 16:38:59.056441+00	2026-01-24 16:38:59.056441+00
bbef4eb1-18d5-4bb9-b441-e93e9ec452da	82859c55-4339-4bfe-a8ce-5c499a5ff858	0c3da5d8-f011-7079-3dbf-33597d3dd94a	DRAFT		2026-01-25 17:20:10.257825+00	2026-01-25 17:20:10.257825+00
daf7384a-2abf-40a7-8af5-28ec515c1e9e	82859c55-4339-4bfe-a8ce-5c499a5ff858	0c3da5d8-f011-7079-3dbf-33597d3dd94a	PENDING		2026-01-25 17:20:13.415877+00	2026-01-25 17:20:13.415877+00
5c1d649d-56cf-4964-9267-3a2f8649405d	82859c55-4339-4bfe-a8ce-5c499a5ff858	bc4d0518-e0a1-70e8-6bcc-c8909ec49408	APPROVED		2026-01-25 17:20:39.941079+00	2026-01-25 17:20:39.941079+00
9400e926-b1f8-4178-a3ee-a8dd85ed2000	82859c55-4339-4bfe-a8ce-5c499a5ff858	bc4d0518-e0a1-70e8-6bcc-c8909ec49408	REJECTED	<div>this is not good at <b>all</b></div>	2026-01-25 18:10:18.86637+00	2026-01-25 18:10:18.86637+00
a2d39637-0889-40bb-826a-e5bedf3ae03c	850b52e3-6572-473c-b102-6b16cd700a13	0c3da5d8-f011-7079-3dbf-33597d3dd94a	DRAFT		2026-01-26 12:27:34.849707+00	2026-01-26 12:27:34.849707+00
69dd72d5-b509-475b-bb7c-71af5a3a8d1d	850b52e3-6572-473c-b102-6b16cd700a13	0c3da5d8-f011-7079-3dbf-33597d3dd94a	PENDING		2026-01-26 12:38:32.761394+00	2026-01-26 12:38:32.761394+00
60f0fb0b-fb73-4797-8542-3d799042b2df	f8554225-9316-4aee-9f53-04567c9d0999	1c4d8538-0041-702d-df81-6f23b7f4ec67	DRAFT		2026-01-26 13:36:29.614022+00	2026-01-26 13:36:29.614022+00
edcfcb98-82fe-43aa-8d77-59147dd96f4f	5f21bcb3-7f98-4baa-afac-5f27b8bae9c9	1c4d8538-0041-702d-df81-6f23b7f4ec67	DRAFT		2026-01-26 13:36:47.116885+00	2026-01-26 13:36:47.116885+00
e8a68bd8-78d4-422f-bebc-6a21d9d502bd	4c408ae8-19b2-4b75-9496-96eb18e3097c	1c4d8538-0041-702d-df81-6f23b7f4ec67	DRAFT		2026-01-26 13:41:17.174925+00	2026-01-26 13:41:17.174925+00
a4bbcf6d-40a8-48b8-afb9-fe7c6260dbde	f8554225-9316-4aee-9f53-04567c9d0999	1c4d8538-0041-702d-df81-6f23b7f4ec67	PENDING		2026-01-26 13:41:21.440986+00	2026-01-26 13:41:21.440986+00
688889bd-91fa-4ef2-97d5-6bb962693d84	5f21bcb3-7f98-4baa-afac-5f27b8bae9c9	1c4d8538-0041-702d-df81-6f23b7f4ec67	PENDING		2026-01-26 13:41:23.883735+00	2026-01-26 13:41:23.883735+00
559908d8-289b-4252-b3d6-836ecb99baee	f8554225-9316-4aee-9f53-04567c9d0999	bc4d0518-e0a1-70e8-6bcc-c8909ec49408	APPROVED		2026-01-26 13:42:56.478578+00	2026-01-26 13:42:56.478578+00
cec419ed-2b72-444b-931b-0373d56f7b52	850b52e3-6572-473c-b102-6b16cd700a13	bc4d0518-e0a1-70e8-6bcc-c8909ec49408	REJECTED	<div>This is not as <b>good</b></div>	2026-01-26 13:43:16.613504+00	2026-01-26 13:43:16.613504+00
caf1463d-44f0-413e-9c24-6c0f6fcb14ca	5f21bcb3-7f98-4baa-afac-5f27b8bae9c9	0c3da5d8-f011-7079-3dbf-33597d3dd94a	REJECTED	<div>Pet License Application 3 is not <b>good</b></div>	2026-01-26 13:45:19.998291+00	2026-01-26 13:45:19.998291+00
3e4a7d3e-cb45-4b55-80fa-8a0b6c637366	1a3ca221-7698-4d04-a5ff-9c820eb22e6a	0c3da5d8-f011-7079-3dbf-33597d3dd94a	PENDING		2026-01-26 14:06:48.650063+00	2026-01-26 14:06:48.650063+00
07ae73d4-59ba-4eda-be63-51cd100f8a60	1a3ca221-7698-4d04-a5ff-9c820eb22e6a	0c3da5d8-f011-7079-3dbf-33597d3dd94a	DRAFT		2026-01-26 14:06:55.563214+00	2026-01-26 14:06:55.563214+00
7a063530-020d-4205-8c30-8436c8502310	5f21bcb3-7f98-4baa-afac-5f27b8bae9c9	1c4d8538-0041-702d-df81-6f23b7f4ec67	DRAFT		2026-01-28 11:52:14.752831+00	2026-01-28 11:52:14.752831+00
c0d503b8-c20d-4bcb-89d1-15fefeeb427f	5f21bcb3-7f98-4baa-afac-5f27b8bae9c9	1c4d8538-0041-702d-df81-6f23b7f4ec67	PENDING		2026-01-28 11:53:04.651911+00	2026-01-28 11:53:04.651911+00
398d69c0-9bad-4ced-914b-df3fdc5551a8	5f21bcb3-7f98-4baa-afac-5f27b8bae9c9	1c4d8538-0041-702d-df81-6f23b7f4ec67	DRAFT		2026-01-28 11:53:25.535029+00	2026-01-28 11:53:25.535029+00
824d6dee-ce7c-48aa-8b3b-bdebf34dac5a	5f21bcb3-7f98-4baa-afac-5f27b8bae9c9	1c4d8538-0041-702d-df81-6f23b7f4ec67	DRAFT		2026-01-28 11:57:25.478645+00	2026-01-28 11:57:25.478645+00
cfbcb6c0-7006-47c3-b0c2-6095ada433ca	5f21bcb3-7f98-4baa-afac-5f27b8bae9c9	1c4d8538-0041-702d-df81-6f23b7f4ec67	PENDING		2026-01-28 11:57:32.347158+00	2026-01-28 11:57:32.347158+00
e127b2dd-da14-4e7c-9fb0-05384d9929de	5f21bcb3-7f98-4baa-afac-5f27b8bae9c9	1c4d8538-0041-702d-df81-6f23b7f4ec67	DRAFT		2026-01-28 11:58:07.795011+00	2026-01-28 11:58:07.795011+00
599bb35a-c5ae-43b4-b867-ecdec78358cc	5f21bcb3-7f98-4baa-afac-5f27b8bae9c9	1c4d8538-0041-702d-df81-6f23b7f4ec67	PENDING		2026-01-28 11:59:10.201889+00	2026-01-28 11:59:10.201889+00
fcd9619c-9f0f-4be3-aea3-d4563730d2f4	5f21bcb3-7f98-4baa-afac-5f27b8bae9c9	1c4d8538-0041-702d-df81-6f23b7f4ec67	DRAFT		2026-01-28 11:59:34.819652+00	2026-01-28 11:59:34.819652+00
58478f1e-e07f-4838-a3f5-12034ffba2bb	5f21bcb3-7f98-4baa-afac-5f27b8bae9c9	1c4d8538-0041-702d-df81-6f23b7f4ec67	DRAFT		2026-01-28 11:59:50.338969+00	2026-01-28 11:59:50.338969+00
d08ff073-ebca-49b1-a0ab-cefa385c0ffe	5f21bcb3-7f98-4baa-afac-5f27b8bae9c9	1c4d8538-0041-702d-df81-6f23b7f4ec67	DRAFT		2026-01-28 12:05:50.505986+00	2026-01-28 12:05:50.505986+00
303c1fe5-8666-41df-9771-59e00e45024c	5f21bcb3-7f98-4baa-afac-5f27b8bae9c9	1c4d8538-0041-702d-df81-6f23b7f4ec67	PENDING		2026-01-28 12:05:57.561113+00	2026-01-28 12:05:57.561113+00
ca7daaf3-9083-4704-b5ed-12b9b24c7193	5f21bcb3-7f98-4baa-afac-5f27b8bae9c9	bc4d0518-e0a1-70e8-6bcc-c8909ec49408	REJECTED	<div>needs a better name</div>	2026-01-28 12:31:52.313656+00	2026-01-28 12:31:52.313656+00
10c6a110-2a6c-4b9b-a9c0-cfaded436812	5f21bcb3-7f98-4baa-afac-5f27b8bae9c9	bc4d0518-e0a1-70e8-6bcc-c8909ec49408	REJECTED	<div>needs a better name \n\n<b>needs some edit</b></div><div><br></div>	2026-01-28 12:44:43.030404+00	2026-01-28 12:44:43.030404+00
1e9de8a1-194c-49fd-a088-884ad21483b6	5f21bcb3-7f98-4baa-afac-5f27b8bae9c9	bc4d0518-e0a1-70e8-6bcc-c8909ec49408	APPROVED		2026-01-28 12:50:30.788134+00	2026-01-28 12:50:30.788134+00
962f615a-08d0-46e6-bbc4-98adf4056493	5f21bcb3-7f98-4baa-afac-5f27b8bae9c9	0c3da5d8-f011-7079-3dbf-33597d3dd94a	DELETED		2026-01-28 13:27:45.861348+00	2026-01-28 13:27:45.861348+00
d9d55897-8465-42c7-af78-d309caf29fd7	4c408ae8-19b2-4b75-9496-96eb18e3097c	1c4d8538-0041-702d-df81-6f23b7f4ec67	PENDING		2026-01-28 17:06:33.229845+00	2026-01-28 17:06:33.229845+00
438c882b-0024-4b23-aba1-f9448755841a	643de53a-a3cb-4aae-a3fe-ed9afc5bd42a	0c3da5d8-f011-7079-3dbf-33597d3dd94a	DRAFT		2026-01-29 13:45:45.225868+00	2026-01-29 13:45:45.225868+00
5c2fbb22-8fb0-441f-82a6-ef759e4cab8f	643de53a-a3cb-4aae-a3fe-ed9afc5bd42a	0c3da5d8-f011-7079-3dbf-33597d3dd94a	PENDING		2026-01-29 19:45:01.400237+00	2026-01-29 19:45:01.400237+00
550176e5-e294-44d3-9a9b-761b563da40e	71ab911b-aa2d-49d6-be90-12ffac760b2e	0c3da5d8-f011-7079-3dbf-33597d3dd94a	DRAFT		2026-01-29 20:10:11.511128+00	2026-01-29 20:10:11.511128+00
6dd73d7e-0cf7-41aa-96c7-6eb89a986204	71ab911b-aa2d-49d6-be90-12ffac760b2e	0c3da5d8-f011-7079-3dbf-33597d3dd94a	PENDING		2026-01-29 20:10:22.804084+00	2026-01-29 20:10:22.804084+00
e54a545c-e39a-4339-8997-83780752e63f	71ab911b-aa2d-49d6-be90-12ffac760b2e	0c3da5d8-f011-7079-3dbf-33597d3dd94a	APPROVED		2026-01-29 20:14:36.764732+00	2026-01-29 20:14:36.764732+00
f187d36d-0c5f-4bbb-aed9-dff837194c5c	71ab911b-aa2d-49d6-be90-12ffac760b2e	0c3da5d8-f011-7079-3dbf-33597d3dd94a	REJECTED	<h1><b>good </b>this is not </h1><div>but thiws is</div>	2026-01-29 20:15:12.804847+00	2026-01-29 20:15:12.804847+00
e31d351c-7da0-4418-863a-7b03c2ee67c6	71ab911b-aa2d-49d6-be90-12ffac760b2e	0c3da5d8-f011-7079-3dbf-33597d3dd94a	DELETED		2026-01-29 20:15:55.580608+00	2026-01-29 20:15:55.580608+00
09c82077-0eb5-4f1b-9aca-1940fc730f1e	f8554225-9316-4aee-9f53-04567c9d0999	0c3da5d8-f011-7079-3dbf-33597d3dd94a	PUBLISHED	Published by John Mayer.	2026-02-03 21:40:22.793791+00	2026-02-03 21:40:22.793791+00
cc0b3ee4-521f-4cf9-940e-81d3eeb54348	850b52e3-6572-473c-b102-6b16cd700a13	0c3da5d8-f011-7079-3dbf-33597d3dd94a	APPROVED		2026-02-04 19:48:04.861417+00	2026-02-04 19:48:04.861417+00
e0d26c4e-abbf-4c7f-a53a-829c738c13d7	a3b9cc7e-f804-48e0-a590-8ddbd1a3d22e	0c3da5d8-f011-7079-3dbf-33597d3dd94a	REJECTED	<div>missing property type "bogus"</div>	2026-02-05 01:22:47.947097+00	2026-02-05 01:22:47.947097+00
\.


--
-- TOC entry 4442 (class 0 OID 16485)
-- Dependencies: 222
-- Data for Name: templates; Type: TABLE DATA; Schema: forms; Owner: pbadmin
--

COPY forms.templates (id, name, description, department_id, organization_id, user_id, schema, created_at, updated_at) FROM stdin;
caf852c6-4711-4725-9078-70459bf95b15	Building Permit	Building permit template	\N	\N	\N	{"form": {"id": null, "title": "Building License Application", "description": "Apply for a residential or commercial building license."}, "fields": [{"name": "applicant_full_name", "type": "text", "label": "Applicant Full Name", "required": true, "placeholder": "Jane Doe", "defaultValue": ""}, {"name": "applicant_email", "type": "email", "label": "Applicant Email", "required": true, "placeholder": "jane@example.com", "defaultValue": ""}, {"name": "applicant_phone", "type": "text", "label": "Applicant Phone", "required": true, "placeholder": "555-123-4567", "defaultValue": ""}, {"name": "property_address", "type": "textarea", "label": "Property Address", "required": true, "placeholder": "123 Main St, Springfield", "defaultValue": ""}, {"name": "project_type", "type": "select", "label": "Project Type", "options": ["New construction", "Renovation", "Addition", "Demolition"], "required": true, "placeholder": "Select project type", "defaultValue": ""}, {"name": "property_type", "type": "radio", "label": "Property Type", "options": ["Residential", "Commercial", "Industrial"], "required": true, "placeholder": "", "defaultValue": ""}, {"name": "estimated_project_cost", "type": "currency", "label": "Estimated Project Cost (USD)", "required": true, "placeholder": "0.00", "defaultValue": ""}, {"name": "estimated_start_date", "type": "date", "label": "Estimated Start Date", "required": true, "placeholder": "", "defaultValue": ""}, {"max": 36, "min": 1, "name": "estimated_completion_months", "type": "number", "label": "Estimated Completion (months)", "required": false, "placeholder": "6", "defaultValue": ""}, {"name": "contractor_name", "type": "text", "label": "Licensed Contractor Name", "required": false, "placeholder": "ABC Construction Ltd.", "defaultValue": ""}, {"name": "contractor_license_number", "type": "text", "label": "Contractor License Number", "required": false, "placeholder": "LIC-123456", "defaultValue": ""}, {"name": "project_description", "type": "textarea", "label": "Project Description", "required": true, "placeholder": "Describe the scope of work.", "defaultValue": ""}, {"name": "documents_attached", "type": "checkbox", "label": "Required Documents Attached", "required": true, "placeholder": "I confirm required documents are attached", "defaultValue": "false"}, {"name": "notice", "type": "static", "label": "Notice", "content": "<p>Applications are reviewed within 10 business days. Additional inspections may be required.</p>", "required": false, "placeholder": "", "defaultValue": ""}]}	2026-01-06 20:21:24.618674+00	2026-01-06 20:21:24.618674+00
9d261e60-c34b-4db5-a0f8-10ba6a6f9c91	Pet License	Pet license for pet owners aka Dog License	\N	\N	\N	{"form": {"id": null, "title": "Pet License Application", "description": "Submit your pet information to apply for a local pet license."}, "fields": [{"name": "owner_full_name", "type": "text", "label": "Owner full name", "required": true, "placeholder": "Jane Doe", "defaultValue": ""}, {"name": "email", "type": "email", "label": "Email", "required": true, "placeholder": "you@example.com", "defaultValue": ""}, {"name": "phone_number", "type": "text", "label": "Phone number", "required": true, "placeholder": "(555) 123-4567", "defaultValue": ""}, {"name": "pet_name", "type": "text", "label": "Pet name", "required": true, "placeholder": "Luna", "defaultValue": ""}, {"name": "species", "type": "select", "label": "Species", "options": ["Dog", "Cat"], "required": true, "placeholder": "", "defaultValue": ""}, {"name": "breed", "type": "text", "label": "Breed", "required": false, "placeholder": "Labrador, Siamese, Mixed", "defaultValue": ""}, {"max": 40, "min": 0, "name": "age_years", "type": "number", "label": "Age (years)", "required": false, "placeholder": "3", "defaultValue": ""}, {"name": "spayed_neutered", "type": "radio", "label": "Spayed/Neutered", "options": ["Yes", "No"], "required": true, "placeholder": "", "defaultValue": ""}, {"name": "microchip_id", "type": "text", "label": "Microchip ID", "required": false, "placeholder": "Optional", "defaultValue": ""}, {"name": "emergency_contact", "type": "text", "label": "Emergency contact", "required": false, "placeholder": "Name and phone", "defaultValue": ""}]}	2026-01-06 15:38:58.441045+00	2026-01-06 21:12:47.519732+00
262f35cb-a142-4011-8a22-7207befd80d7	My Pet License	Submit your pet information to apply for a local pet license.	245fe4b4-8173-4b92-97c9-b8db1c3513c1	e61459fe-1fdd-4ef7-968e-988783dcac00	\N	{"form": {"id": "643de53a-a3cb-4aae-a3fe-ed9afc5bd42a", "title": "My Pet License", "templateId": "9d261e60-c34b-4db5-a0f8-10ba6a6f9c91", "description": "Submit your pet information to apply for a local pet license."}, "fields": [{"name": "owner_full_namo", "type": "text", "label": "Owner full namo", "required": true, "placeholder": "Jane Doe", "defaultValue": ""}, {"name": "email", "type": "email", "label": "Email", "required": true, "placeholder": "you@example.com", "defaultValue": ""}, {"name": "phone_number", "type": "text", "label": "Phone number", "required": true, "placeholder": "(555) 123-4567", "defaultValue": ""}, {"name": "pet_name", "type": "text", "label": "Pet name", "required": true, "placeholder": "Luna", "defaultValue": ""}, {"name": "species", "type": "select", "label": "Species", "options": ["Dog", "Cat"], "required": true, "placeholder": "", "defaultValue": ""}, {"name": "breed", "type": "text", "label": "Breed", "required": false, "placeholder": "Labrador, Siamese, Mixed", "defaultValue": ""}, {"max": 40, "min": 0, "name": "age_years", "type": "number", "label": "Age (years)", "required": false, "placeholder": "3", "defaultValue": ""}, {"name": "spayed_neutered", "type": "radio", "label": "Spayed/Neutered", "options": ["Yes", "No"], "required": true, "placeholder": "", "defaultValue": ""}, {"name": "microchip_id", "type": "text", "label": "Microchip ID", "required": false, "placeholder": "Optional", "defaultValue": ""}, {"name": "emergency_contact", "type": "text", "label": "Emergency contact", "required": false, "placeholder": "Name and phone", "defaultValue": ""}]}	2026-01-20 19:53:11.061602+00	2026-01-20 20:08:43.40761+00
\.


--
-- TOC entry 4443 (class 0 OID 16492)
-- Dependencies: 223
-- Data for Name: departments; Type: TABLE DATA; Schema: orgs; Owner: pbadmin
--

COPY orgs.departments (id, organization_id, name, created_at, updated_at) FROM stdin;
245fe4b4-8173-4b92-97c9-b8db1c3513c1	e61459fe-1fdd-4ef7-968e-988783dcac00	$default	2025-12-23 19:39:10.642538+00	2025-12-23 19:39:10.642538+00
\.


--
-- TOC entry 4444 (class 0 OID 16499)
-- Dependencies: 224
-- Data for Name: organizations; Type: TABLE DATA; Schema: orgs; Owner: pbadmin
--

COPY orgs.organizations (id, name, created_at, updated_at, country_state) FROM stdin;
e61459fe-1fdd-4ef7-968e-988783dcac00	Twin Peaks	2025-12-23 19:38:19.93243+00	2026-01-13 17:59:42.618948+00	ca-on
\.


--
-- TOC entry 4445 (class 0 OID 16506)
-- Dependencies: 225
-- Data for Name: roles; Type: TABLE DATA; Schema: orgs; Owner: pbadmin
--

COPY orgs.roles (id, name, description, created_at, updated_at) FROM stdin;
ADMIN	Administrator	An Administrator that is able to do everything a form creator can do and create other lower level users, and promote forms	2025-12-24 14:24:27.396044+00	2026-01-02 17:33:31.450286+00
CREATOR	Creator	A Creator is able to create and edit forms and submit for approval. once approved they can promote to production.	2026-01-02 17:30:46.496341+00	2026-01-02 17:34:03.067768+00
REVIEWER	Reviewer	A reviewer is able to accept or reject a form	2026-01-02 17:32:21.503809+00	2026-01-05 14:42:54.85155+00
PROCESSOR	Processor	A Processor can view and manage form submissions, update submission status, and perform operational actions on submitted data.	2026-02-03 22:38:31.792282+00	2026-02-03 22:38:31.792282+00
\.


--
-- TOC entry 4446 (class 0 OID 16513)
-- Dependencies: 226
-- Data for Name: users; Type: TABLE DATA; Schema: orgs; Owner: pbadmin
--

COPY orgs.users (id, first_name, last_name, created_at, updated_at, email, phone, phone_type, status) FROM stdin;
fc1d45a8-f061-703e-af41-f3b0fd0d8e3d	Dua	Lipa	2026-01-09 02:55:31.94579+00	2026-01-12 17:15:36.612513+00	dua.llipa@willem.io	\N	\N	DELETED
1c4d8538-0041-702d-df81-6f23b7f4ec67	donald	Duck	2026-01-26 13:12:04.235886+00	2026-01-26 13:12:04.235886+00	donald.duck@willem.io	\N	\N	ACTIVE
dc8d2548-1011-7014-dfe4-81c4616a0e0f	Oliver B	Bommel	2026-01-27 18:56:07.152293+00	2026-01-29 15:41:59.164922+00	oliver.b.bommel@willem.io	\N	\N	INACTIVE
7c7d55a8-30c1-703e-0c4c-9bdf9af5da6c	Franky	Sinatra	2026-01-09 02:48:29.09061+00	2026-01-29 15:42:23.529278+00	franky.sinatra@willem.io	\N	\N	DELETED
bc4d0518-e0a1-70e8-6bcc-c8909ec49408	Mickey	Mouse	2026-01-22 13:54:04.925758+00	2026-02-03 22:42:30.845165+00	mickey.mouse@willem.io	\N	\N	ACTIVE
0c3da5d8-f011-7079-3dbf-33597d3dd94a	John	Mayer	2025-12-24 14:02:51.993332+00	2026-02-03 22:44:42.62703+00	john.mayer@publicbase.com	+1-519-619-5058	MOBILE	ACTIVE
\.


--
-- TOC entry 4447 (class 0 OID 16521)
-- Dependencies: 227
-- Data for Name: users_departments; Type: TABLE DATA; Schema: orgs; Owner: pbadmin
--

COPY orgs.users_departments (user_id, department_id, created_at, updated_at) FROM stdin;
0c3da5d8-f011-7079-3dbf-33597d3dd94a	245fe4b4-8173-4b92-97c9-b8db1c3513c1	2025-12-26 16:30:33.081499+00	2025-12-26 16:30:33.081499+00
7c7d55a8-30c1-703e-0c4c-9bdf9af5da6c	245fe4b4-8173-4b92-97c9-b8db1c3513c1	2026-01-09 02:48:29.09061+00	2026-01-09 02:48:29.09061+00
fc1d45a8-f061-703e-af41-f3b0fd0d8e3d	245fe4b4-8173-4b92-97c9-b8db1c3513c1	2026-01-09 02:55:31.94579+00	2026-01-09 02:55:31.94579+00
bc4d0518-e0a1-70e8-6bcc-c8909ec49408	245fe4b4-8173-4b92-97c9-b8db1c3513c1	2026-01-22 13:54:04.925758+00	2026-01-22 13:54:04.925758+00
1c4d8538-0041-702d-df81-6f23b7f4ec67	245fe4b4-8173-4b92-97c9-b8db1c3513c1	2026-01-26 13:12:04.235886+00	2026-01-26 13:12:04.235886+00
dc8d2548-1011-7014-dfe4-81c4616a0e0f	245fe4b4-8173-4b92-97c9-b8db1c3513c1	2026-01-27 18:56:07.152293+00	2026-01-27 18:56:07.152293+00
\.


--
-- TOC entry 4448 (class 0 OID 16526)
-- Dependencies: 228
-- Data for Name: users_roles; Type: TABLE DATA; Schema: orgs; Owner: pbadmin
--

COPY orgs.users_roles (user_id, roles_id) FROM stdin;
fc1d45a8-f061-703e-af41-f3b0fd0d8e3d	CREATOR
7c7d55a8-30c1-703e-0c4c-9bdf9af5da6c	CREATOR
1c4d8538-0041-702d-df81-6f23b7f4ec67	CREATOR
dc8d2548-1011-7014-dfe4-81c4616a0e0f	ADMIN
bc4d0518-e0a1-70e8-6bcc-c8909ec49408	PROCESSOR
bc4d0518-e0a1-70e8-6bcc-c8909ec49408	REVIEWER
0c3da5d8-f011-7079-3dbf-33597d3dd94a	ADMIN
0c3da5d8-f011-7079-3dbf-33597d3dd94a	CREATOR
0c3da5d8-f011-7079-3dbf-33597d3dd94a	PROCESSOR
0c3da5d8-f011-7079-3dbf-33597d3dd94a	REVIEWER
\.


--
-- TOC entry 4451 (class 0 OID 16654)
-- Dependencies: 231
-- Data for Name: notification_type; Type: TABLE DATA; Schema: publish; Owner: pbadmin
--

COPY publish.notification_type (id, name, description, "order", supports_results) FROM stdin;
SMS	SMS Text	Receive a SMS text when a new submission has been received	30	f
EMAIL	Email	Receive an email when a new submission has been received	10	t
API	API	Notify the API endpoint	20	t
\.


--
-- TOC entry 4452 (class 0 OID 16661)
-- Dependencies: 232
-- Data for Name: notification_type_notifications; Type: TABLE DATA; Schema: publish; Owner: pbadmin
--

COPY publish.notification_type_notifications (notification_id, notification_type, include_results) FROM stdin;
\.


--
-- TOC entry 4450 (class 0 OID 16639)
-- Dependencies: 230
-- Data for Name: notifications; Type: TABLE DATA; Schema: publish; Owner: pbadmin
--

COPY publish.notifications (id, user_id, form_id) FROM stdin;
5fb1ae97-2991-4634-ac45-b4749a40c0ad	bc4d0518-e0a1-70e8-6bcc-c8909ec49408	f8554225-9316-4aee-9f53-04567c9d0999
\.


--
-- TOC entry 4453 (class 0 OID 16750)
-- Dependencies: 233
-- Data for Name: statuses; Type: TABLE DATA; Schema: publish; Owner: pbadmin
--

COPY publish.statuses (id, user_id, status, submission_id) FROM stdin;
\.


--
-- TOC entry 4449 (class 0 OID 16622)
-- Dependencies: 229
-- Data for Name: submissions; Type: TABLE DATA; Schema: publish; Owner: pbadmin
--

COPY publish.submissions (id, form_id, data) FROM stdin;
\.


--
-- TOC entry 4236 (class 2606 OID 16539)
-- Name: forms form_pk; Type: CONSTRAINT; Schema: forms; Owner: pbadmin
--

ALTER TABLE ONLY forms.forms
    ADD CONSTRAINT form_pk PRIMARY KEY (id);


--
-- TOC entry 4238 (class 2606 OID 16541)
-- Name: statuses review_pk; Type: CONSTRAINT; Schema: forms; Owner: pbadmin
--

ALTER TABLE ONLY forms.statuses
    ADD CONSTRAINT review_pk PRIMARY KEY (id);


--
-- TOC entry 4240 (class 2606 OID 16543)
-- Name: templates template_pk; Type: CONSTRAINT; Schema: forms; Owner: pbadmin
--

ALTER TABLE ONLY forms.templates
    ADD CONSTRAINT template_pk PRIMARY KEY (id);


--
-- TOC entry 4242 (class 2606 OID 16545)
-- Name: departments departments_pk; Type: CONSTRAINT; Schema: orgs; Owner: pbadmin
--

ALTER TABLE ONLY orgs.departments
    ADD CONSTRAINT departments_pk PRIMARY KEY (id);


--
-- TOC entry 4248 (class 2606 OID 16547)
-- Name: roles name_unique; Type: CONSTRAINT; Schema: orgs; Owner: pbadmin
--

ALTER TABLE ONLY orgs.roles
    ADD CONSTRAINT name_unique UNIQUE (name);


--
-- TOC entry 4244 (class 2606 OID 16549)
-- Name: organizations organizations_pk; Type: CONSTRAINT; Schema: orgs; Owner: pbadmin
--

ALTER TABLE ONLY orgs.organizations
    ADD CONSTRAINT organizations_pk PRIMARY KEY (id);


--
-- TOC entry 4246 (class 2606 OID 16551)
-- Name: organizations organizations_unique_name; Type: CONSTRAINT; Schema: orgs; Owner: pbadmin
--

ALTER TABLE ONLY orgs.organizations
    ADD CONSTRAINT organizations_unique_name UNIQUE (name);


--
-- TOC entry 4250 (class 2606 OID 16553)
-- Name: roles roles_pk; Type: CONSTRAINT; Schema: orgs; Owner: pbadmin
--

ALTER TABLE ONLY orgs.roles
    ADD CONSTRAINT roles_pk PRIMARY KEY (id);


--
-- TOC entry 4254 (class 2606 OID 16555)
-- Name: users_departments users_departments_pk; Type: CONSTRAINT; Schema: orgs; Owner: pbadmin
--

ALTER TABLE ONLY orgs.users_departments
    ADD CONSTRAINT users_departments_pk PRIMARY KEY (user_id, department_id);


--
-- TOC entry 4252 (class 2606 OID 16557)
-- Name: users users_pk; Type: CONSTRAINT; Schema: orgs; Owner: pbadmin
--

ALTER TABLE ONLY orgs.users
    ADD CONSTRAINT users_pk PRIMARY KEY (id);


--
-- TOC entry 4256 (class 2606 OID 16559)
-- Name: users_roles users_roles_pk; Type: CONSTRAINT; Schema: orgs; Owner: pbadmin
--

ALTER TABLE ONLY orgs.users_roles
    ADD CONSTRAINT users_roles_pk PRIMARY KEY (user_id, roles_id);


--
-- TOC entry 4267 (class 2606 OID 16697)
-- Name: notification_type_notifications notification_type_notifications_pk; Type: CONSTRAINT; Schema: publish; Owner: pbadmin
--

ALTER TABLE ONLY publish.notification_type_notifications
    ADD CONSTRAINT notification_type_notifications_pk PRIMARY KEY (notification_id, notification_type);


--
-- TOC entry 4262 (class 2606 OID 16680)
-- Name: notification_type notification_type_pk; Type: CONSTRAINT; Schema: publish; Owner: pbadmin
--

ALTER TABLE ONLY publish.notification_type
    ADD CONSTRAINT notification_type_pk PRIMARY KEY (id);


--
-- TOC entry 4264 (class 2606 OID 16695)
-- Name: notification_type notification_type_unique; Type: CONSTRAINT; Schema: publish; Owner: pbadmin
--

ALTER TABLE ONLY publish.notification_type
    ADD CONSTRAINT notification_type_unique UNIQUE (id);


--
-- TOC entry 4260 (class 2606 OID 16643)
-- Name: notifications notifications_pk; Type: CONSTRAINT; Schema: publish; Owner: pbadmin
--

ALTER TABLE ONLY publish.notifications
    ADD CONSTRAINT notifications_pk PRIMARY KEY (id);


--
-- TOC entry 4269 (class 2606 OID 16757)
-- Name: statuses statuses_pk; Type: CONSTRAINT; Schema: publish; Owner: pbadmin
--

ALTER TABLE ONLY publish.statuses
    ADD CONSTRAINT statuses_pk PRIMARY KEY (id);


--
-- TOC entry 4258 (class 2606 OID 16628)
-- Name: submissions submissions_pk; Type: CONSTRAINT; Schema: publish; Owner: pbadmin
--

ALTER TABLE ONLY publish.submissions
    ADD CONSTRAINT submissions_pk PRIMARY KEY (id);


--
-- TOC entry 4265 (class 1259 OID 16674)
-- Name: notification_type_notifications_notification_id_idx; Type: INDEX; Schema: publish; Owner: pbadmin
--

CREATE INDEX notification_type_notifications_notification_id_idx ON publish.notification_type_notifications USING btree (notification_id);


--
-- TOC entry 4287 (class 2620 OID 16562)
-- Name: forms set_updated_at_forms; Type: TRIGGER; Schema: forms; Owner: pbadmin
--

CREATE TRIGGER set_updated_at_forms BEFORE UPDATE ON forms.forms FOR EACH ROW EXECUTE FUNCTION orgs.set_updated_at();


--
-- TOC entry 4288 (class 2620 OID 16563)
-- Name: statuses set_updated_at_reviews; Type: TRIGGER; Schema: forms; Owner: pbadmin
--

CREATE TRIGGER set_updated_at_reviews BEFORE UPDATE ON forms.statuses FOR EACH ROW EXECUTE FUNCTION forms.set_updated_at();


--
-- TOC entry 4289 (class 2620 OID 16564)
-- Name: templates set_updated_at_templates; Type: TRIGGER; Schema: forms; Owner: pbadmin
--

CREATE TRIGGER set_updated_at_templates BEFORE UPDATE ON forms.templates FOR EACH ROW EXECUTE FUNCTION orgs.set_updated_at();


--
-- TOC entry 4290 (class 2620 OID 16565)
-- Name: departments set_updated_at_departments; Type: TRIGGER; Schema: orgs; Owner: pbadmin
--

CREATE TRIGGER set_updated_at_departments BEFORE UPDATE ON orgs.departments FOR EACH ROW EXECUTE FUNCTION orgs.set_updated_at();


--
-- TOC entry 4291 (class 2620 OID 16566)
-- Name: organizations set_updated_at_organizations; Type: TRIGGER; Schema: orgs; Owner: pbadmin
--

CREATE TRIGGER set_updated_at_organizations BEFORE UPDATE ON orgs.organizations FOR EACH ROW EXECUTE FUNCTION orgs.set_updated_at();


--
-- TOC entry 4292 (class 2620 OID 16567)
-- Name: roles set_updated_at_roles; Type: TRIGGER; Schema: orgs; Owner: pbadmin
--

CREATE TRIGGER set_updated_at_roles BEFORE UPDATE ON orgs.roles FOR EACH ROW EXECUTE FUNCTION orgs.set_updated_at();


--
-- TOC entry 4293 (class 2620 OID 16568)
-- Name: users set_updated_at_users; Type: TRIGGER; Schema: orgs; Owner: pbadmin
--

CREATE TRIGGER set_updated_at_users BEFORE UPDATE ON orgs.users FOR EACH ROW EXECUTE FUNCTION orgs.set_updated_at();


--
-- TOC entry 4294 (class 2620 OID 16569)
-- Name: users_departments set_updated_at_users_departments; Type: TRIGGER; Schema: orgs; Owner: pbadmin
--

CREATE TRIGGER set_updated_at_users_departments BEFORE UPDATE ON orgs.users_departments FOR EACH ROW EXECUTE FUNCTION orgs.set_updated_at();


--
-- TOC entry 4270 (class 2606 OID 16571)
-- Name: statuses reviews_forms_fk; Type: FK CONSTRAINT; Schema: forms; Owner: pbadmin
--

ALTER TABLE ONLY forms.statuses
    ADD CONSTRAINT reviews_forms_fk FOREIGN KEY (form_id) REFERENCES forms.forms(id) ON DELETE CASCADE;


--
-- TOC entry 4271 (class 2606 OID 16576)
-- Name: statuses reviews_users_fk; Type: FK CONSTRAINT; Schema: forms; Owner: pbadmin
--

ALTER TABLE ONLY forms.statuses
    ADD CONSTRAINT reviews_users_fk FOREIGN KEY (user_id) REFERENCES orgs.users(id);


--
-- TOC entry 4272 (class 2606 OID 16581)
-- Name: templates template_departments_fk; Type: FK CONSTRAINT; Schema: forms; Owner: pbadmin
--

ALTER TABLE ONLY forms.templates
    ADD CONSTRAINT template_departments_fk FOREIGN KEY (department_id) REFERENCES orgs.departments(id);


--
-- TOC entry 4273 (class 2606 OID 16586)
-- Name: templates template_organizations_fk; Type: FK CONSTRAINT; Schema: forms; Owner: pbadmin
--

ALTER TABLE ONLY forms.templates
    ADD CONSTRAINT template_organizations_fk FOREIGN KEY (organization_id) REFERENCES orgs.organizations(id);


--
-- TOC entry 4274 (class 2606 OID 16591)
-- Name: templates template_users_fk; Type: FK CONSTRAINT; Schema: forms; Owner: pbadmin
--

ALTER TABLE ONLY forms.templates
    ADD CONSTRAINT template_users_fk FOREIGN KEY (user_id) REFERENCES orgs.users(id);


--
-- TOC entry 4275 (class 2606 OID 16596)
-- Name: departments departments_organizations_fk; Type: FK CONSTRAINT; Schema: orgs; Owner: pbadmin
--

ALTER TABLE ONLY orgs.departments
    ADD CONSTRAINT departments_organizations_fk FOREIGN KEY (organization_id) REFERENCES orgs.organizations(id);


--
-- TOC entry 4276 (class 2606 OID 16601)
-- Name: users_departments users_departments_departments_fk; Type: FK CONSTRAINT; Schema: orgs; Owner: pbadmin
--

ALTER TABLE ONLY orgs.users_departments
    ADD CONSTRAINT users_departments_departments_fk FOREIGN KEY (department_id) REFERENCES orgs.departments(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4277 (class 2606 OID 16606)
-- Name: users_departments users_departments_users_fk; Type: FK CONSTRAINT; Schema: orgs; Owner: pbadmin
--

ALTER TABLE ONLY orgs.users_departments
    ADD CONSTRAINT users_departments_users_fk FOREIGN KEY (user_id) REFERENCES orgs.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4278 (class 2606 OID 16611)
-- Name: users_roles users_roles_roles_fk; Type: FK CONSTRAINT; Schema: orgs; Owner: pbadmin
--

ALTER TABLE ONLY orgs.users_roles
    ADD CONSTRAINT users_roles_roles_fk FOREIGN KEY (roles_id) REFERENCES orgs.roles(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4279 (class 2606 OID 16616)
-- Name: users_roles users_roles_users_fk; Type: FK CONSTRAINT; Schema: orgs; Owner: pbadmin
--

ALTER TABLE ONLY orgs.users_roles
    ADD CONSTRAINT users_roles_users_fk FOREIGN KEY (user_id) REFERENCES orgs.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4283 (class 2606 OID 16707)
-- Name: notification_type_notifications notification_type_notifications_notification_type_fk; Type: FK CONSTRAINT; Schema: publish; Owner: pbadmin
--

ALTER TABLE ONLY publish.notification_type_notifications
    ADD CONSTRAINT notification_type_notifications_notification_type_fk FOREIGN KEY (notification_type) REFERENCES publish.notification_type(id);


--
-- TOC entry 4284 (class 2606 OID 16689)
-- Name: notification_type_notifications notification_type_notifications_notifications_fk; Type: FK CONSTRAINT; Schema: publish; Owner: pbadmin
--

ALTER TABLE ONLY publish.notification_type_notifications
    ADD CONSTRAINT notification_type_notifications_notifications_fk FOREIGN KEY (notification_id) REFERENCES publish.notifications(id);


--
-- TOC entry 4281 (class 2606 OID 16649)
-- Name: notifications notifications_forms_fk; Type: FK CONSTRAINT; Schema: publish; Owner: pbadmin
--

ALTER TABLE ONLY publish.notifications
    ADD CONSTRAINT notifications_forms_fk FOREIGN KEY (form_id) REFERENCES forms.forms(id);


--
-- TOC entry 4282 (class 2606 OID 16644)
-- Name: notifications notifications_users_fk; Type: FK CONSTRAINT; Schema: publish; Owner: pbadmin
--

ALTER TABLE ONLY publish.notifications
    ADD CONSTRAINT notifications_users_fk FOREIGN KEY (user_id) REFERENCES orgs.users(id);


--
-- TOC entry 4285 (class 2606 OID 16763)
-- Name: statuses statuses_submissions_fk; Type: FK CONSTRAINT; Schema: publish; Owner: pbadmin
--

ALTER TABLE ONLY publish.statuses
    ADD CONSTRAINT statuses_submissions_fk FOREIGN KEY (submission_id) REFERENCES publish.submissions(id);


--
-- TOC entry 4286 (class 2606 OID 16758)
-- Name: statuses statuses_users_fk; Type: FK CONSTRAINT; Schema: publish; Owner: pbadmin
--

ALTER TABLE ONLY publish.statuses
    ADD CONSTRAINT statuses_users_fk FOREIGN KEY (user_id) REFERENCES orgs.users(id);


--
-- TOC entry 4280 (class 2606 OID 16629)
-- Name: submissions submissions_forms_fk; Type: FK CONSTRAINT; Schema: publish; Owner: pbadmin
--

ALTER TABLE ONLY publish.submissions
    ADD CONSTRAINT submissions_forms_fk FOREIGN KEY (form_id) REFERENCES forms.forms(id);


--
-- TOC entry 4459 (class 0 OID 0)
-- Dependencies: 8
-- Name: SCHEMA forms; Type: ACL; Schema: -; Owner: pbadmin
--

GRANT USAGE ON SCHEMA forms TO pbform;


--
-- TOC entry 4460 (class 0 OID 0)
-- Dependencies: 7
-- Name: SCHEMA publish; Type: ACL; Schema: -; Owner: pbadmin
--

GRANT USAGE ON SCHEMA publish TO pbform;


--
-- TOC entry 4461 (class 0 OID 0)
-- Dependencies: 220
-- Name: TABLE forms; Type: ACL; Schema: forms; Owner: pbadmin
--

GRANT SELECT ON TABLE forms.forms TO pbform;


--
-- TOC entry 4462 (class 0 OID 0)
-- Dependencies: 229
-- Name: TABLE submissions; Type: ACL; Schema: publish; Owner: pbadmin
--

GRANT INSERT ON TABLE publish.submissions TO pbform;


-- Completed on 2026-02-06 06:49:43 EST

--
-- PostgreSQL database dump complete
--

\unrestrict 1po5nf7yXXKEZQ0Hr177A132XG7owdaB9hcD6RkPCIlLwajhMbtTJgBVQq5KEzS

