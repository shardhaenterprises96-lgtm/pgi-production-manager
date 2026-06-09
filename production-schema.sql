--
-- PostgreSQL database dump
--

\restrict 2P7W0ZsnQ0vcLzRhLbTMvcDGEkeDiz5ElEbeJwrLW1bMBxlLAylc2WaeMA9p2NX

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: account_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_transactions (
    id integer NOT NULL,
    receipt_no text,
    account_id integer NOT NULL,
    direction text NOT NULL,
    amount numeric(14,2) NOT NULL,
    mode text DEFAULT 'cash'::text NOT NULL,
    party_name text,
    notes text,
    created_by_id integer,
    created_by_name text,
    created_by_role text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    party_mobile text,
    party_entity_id integer
);


--
-- Name: account_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.account_transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: account_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.account_transactions_id_seq OWNED BY public.account_transactions.id;


--
-- Name: accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounts (
    id integer NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    identifier text,
    opening_balance numeric(14,2) DEFAULT 0 NOT NULL,
    current_balance numeric(14,2) DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: accounts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.accounts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: accounts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.accounts_id_seq OWNED BY public.accounts.id;


--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log (
    id integer NOT NULL,
    action text NOT NULL,
    description text,
    user_id integer NOT NULL,
    user_name text,
    metadata text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.audit_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: audit_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.audit_log_id_seq OWNED BY public.audit_log.id;


--
-- Name: bom_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bom_items (
    id integer NOT NULL,
    bom_id integer NOT NULL,
    material_product_id integer NOT NULL,
    quantity numeric(12,3) NOT NULL,
    unit text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: bom_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bom_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bom_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bom_items_id_seq OWNED BY public.bom_items.id;


--
-- Name: boms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.boms (
    id integer NOT NULL,
    finished_product_id integer NOT NULL,
    output_quantity numeric(12,3) DEFAULT '1'::numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: boms_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.boms_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: boms_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.boms_id_seq OWNED BY public.boms.id;


--
-- Name: capital_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.capital_snapshots (
    id integer NOT NULL,
    snapshot_date date NOT NULL,
    inventory_value numeric(16,2) DEFAULT '0'::numeric NOT NULL,
    receivable numeric(16,2) DEFAULT '0'::numeric NOT NULL,
    cash_in_accounts numeric(16,2) DEFAULT '0'::numeric NOT NULL,
    payable numeric(16,2) DEFAULT '0'::numeric NOT NULL,
    capital numeric(16,2) DEFAULT '0'::numeric NOT NULL,
    captured_at timestamp with time zone DEFAULT now() NOT NULL,
    expenses numeric(16,2) DEFAULT '0'::numeric NOT NULL
);


--
-- Name: capital_snapshots_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.capital_snapshots_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: capital_snapshots_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.capital_snapshots_id_seq OWNED BY public.capital_snapshots.id;


--
-- Name: customer_order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_order_items (
    id integer NOT NULL,
    order_id integer NOT NULL,
    product_id integer NOT NULL,
    product_name text NOT NULL,
    unit text,
    qty numeric(12,3) NOT NULL,
    unit_price numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    line_total numeric(14,2) DEFAULT '0'::numeric NOT NULL,
    workload_card_id integer
);


--
-- Name: customer_order_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.customer_order_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: customer_order_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.customer_order_items_id_seq OWNED BY public.customer_order_items.id;


--
-- Name: customer_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_orders (
    id integer NOT NULL,
    order_no text,
    user_id integer,
    entity_id integer,
    customer_name text NOT NULL,
    customer_mobile text,
    status text DEFAULT 'pending'::text NOT NULL,
    is_draft boolean DEFAULT false NOT NULL,
    total_items integer DEFAULT 0 NOT NULL,
    total_amount numeric(14,2) DEFAULT '0'::numeric NOT NULL,
    notes text,
    admin_remarks text,
    vehicle_number text,
    driver_name text,
    dispatch_date timestamp with time zone,
    dispatch_status text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: customer_orders_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.customer_orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: customer_orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.customer_orders_id_seq OWNED BY public.customer_orders.id;


--
-- Name: entities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.entities (
    id integer NOT NULL,
    type text NOT NULL,
    name text NOT NULL,
    mobile text NOT NULL,
    gstin text,
    address text,
    city text,
    state text,
    district text,
    area text,
    pin_code text,
    gps_location text,
    pricing_tier text DEFAULT 'retail'::text,
    outstanding_balance numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    credit_limit numeric(12,2),
    user_id integer,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: entities_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.entities_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: entities_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.entities_id_seq OWNED BY public.entities.id;


--
-- Name: expense_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expense_categories (
    id integer NOT NULL,
    name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: expense_categories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.expense_categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: expense_categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.expense_categories_id_seq OWNED BY public.expense_categories.id;


--
-- Name: expenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expenses (
    id integer NOT NULL,
    date date NOT NULL,
    category_id integer,
    category_name text NOT NULL,
    amount numeric(14,2) NOT NULL,
    payment_mode text NOT NULL,
    paid_to text,
    notes text,
    created_by_user_id integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: expenses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.expenses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: expenses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.expenses_id_seq OWNED BY public.expenses.id;


--
-- Name: invoice_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice_items (
    id integer NOT NULL,
    invoice_id integer NOT NULL,
    product_id integer NOT NULL,
    product_name text NOT NULL,
    hsn_code text,
    qty numeric(12,3) NOT NULL,
    qty_boxes numeric(12,3),
    total_liters numeric(12,3),
    unit text NOT NULL,
    rate numeric(12,2) NOT NULL,
    mrp numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    discount_pct numeric(5,2) DEFAULT '0'::numeric NOT NULL,
    discount_amt numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    tax_pct numeric(5,2) DEFAULT '0'::numeric NOT NULL,
    cess_pct numeric(5,2) DEFAULT '0'::numeric NOT NULL,
    net_price numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    amount numeric(12,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: invoice_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.invoice_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: invoice_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.invoice_items_id_seq OWNED BY public.invoice_items.id;


--
-- Name: invoice_sequence; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice_sequence (
    id integer NOT NULL,
    month integer NOT NULL,
    year integer NOT NULL,
    last_number integer DEFAULT 0 NOT NULL
);


--
-- Name: invoice_sequence_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.invoice_sequence_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: invoice_sequence_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.invoice_sequence_id_seq OWNED BY public.invoice_sequence.id;


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoices (
    id integer NOT NULL,
    invoice_no text NOT NULL,
    invoice_date timestamp with time zone DEFAULT now() NOT NULL,
    due_date timestamp with time zone,
    invoice_type text DEFAULT 'gst'::text NOT NULL,
    customer_id integer,
    customer_name text,
    customer_gstin text,
    billing_address text,
    shipping_address text,
    place_of_supply text DEFAULT 'Maharashtra'::text NOT NULL,
    salesman_id integer,
    salesman_name text,
    po_number text,
    e_way_bill_no text,
    subtotal numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    total_discount numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    total_tax numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    cgst numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    sgst numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    igst numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    freight numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    round_off numeric(6,2) DEFAULT '0'::numeric NOT NULL,
    grand_total numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    amount_paid numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    balance_due numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    status text DEFAULT 'saved'::text NOT NULL,
    created_by_user_id integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: invoices_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.invoices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: invoices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.invoices_id_seq OWNED BY public.invoices.id;


--
-- Name: ledger_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ledger_entries (
    id integer NOT NULL,
    entity_id integer NOT NULL,
    date timestamp with time zone DEFAULT now() NOT NULL,
    description text NOT NULL,
    debit numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    credit numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    balance numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    type text NOT NULL,
    reference_id integer,
    reference_no text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ledger_entries_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ledger_entries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ledger_entries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ledger_entries_id_seq OWNED BY public.ledger_entries.id;


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    id integer NOT NULL,
    receipt_id text NOT NULL,
    customer_id integer NOT NULL,
    customer_name text,
    salesman_id integer,
    salesman_name text,
    amount numeric(12,2) NOT NULL,
    mode text DEFAULT 'cash'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    notes text,
    approved_by_id integer,
    approved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    account_id integer,
    collected_at timestamp with time zone,
    collected_by_id integer
);


--
-- Name: payments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payments_id_seq OWNED BY public.payments.id;


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id integer NOT NULL,
    name text NOT NULL,
    print_name text,
    "group" text NOT NULL,
    brand text NOT NULL,
    item_code text NOT NULL,
    unit text DEFAULT 'QTY'::text NOT NULL,
    purchase_price numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    retail_price numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    wholesale_price numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    mrp numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    min_sale_price numeric(12,2),
    current_stock numeric(12,3) DEFAULT '0'::numeric NOT NULL,
    opening_stock numeric(12,3),
    opening_stock_value numeric(12,2),
    pricing_basis text DEFAULT 'manual'::text NOT NULL,
    wholesale_margin numeric(10,2),
    retail_margin numeric(10,2),
    hsn_code text,
    tax_rate numeric(5,2) DEFAULT '18'::numeric,
    commission_per_liter numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    liters_per_box numeric(10,3),
    not_for_sale boolean DEFAULT false NOT NULL,
    add_for_manufacturing boolean DEFAULT false NOT NULL,
    min_stock_threshold numeric(12,3),
    image_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    units_per_box numeric(10,3)
);


--
-- Name: products_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.products_id_seq OWNED BY public.products.id;


--
-- Name: purchase_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_items (
    id integer NOT NULL,
    purchase_id integer NOT NULL,
    product_id integer NOT NULL,
    product_name text NOT NULL,
    hsn_code text,
    qty numeric(12,3) NOT NULL,
    unit text NOT NULL,
    rate numeric(12,2) NOT NULL,
    discount_pct numeric(5,2) DEFAULT '0'::numeric NOT NULL,
    discount_amt numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    tax_pct numeric(5,2) DEFAULT '0'::numeric NOT NULL,
    amount numeric(12,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: purchase_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.purchase_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: purchase_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.purchase_items_id_seq OWNED BY public.purchase_items.id;


--
-- Name: purchase_sequence; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_sequence (
    id integer NOT NULL,
    month integer NOT NULL,
    year integer NOT NULL,
    last_number integer DEFAULT 0 NOT NULL
);


--
-- Name: purchase_sequence_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.purchase_sequence_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: purchase_sequence_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.purchase_sequence_id_seq OWNED BY public.purchase_sequence.id;


--
-- Name: purchases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchases (
    id integer NOT NULL,
    bill_no text NOT NULL,
    vendor_bill_no text,
    bill_date timestamp with time zone DEFAULT now() NOT NULL,
    due_date timestamp with time zone,
    bill_type text DEFAULT 'gst'::text NOT NULL,
    vendor_id integer,
    vendor_name text,
    vendor_gstin text,
    place_of_supply text DEFAULT 'Maharashtra'::text NOT NULL,
    notes text,
    subtotal numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    total_discount numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    total_tax numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    cgst numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    sgst numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    igst numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    freight numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    round_off numeric(6,2) DEFAULT '0'::numeric NOT NULL,
    grand_total numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    amount_paid numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    balance_due numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    status text DEFAULT 'saved'::text NOT NULL,
    created_by_user_id integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: purchases_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.purchases_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: purchases_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.purchases_id_seq OWNED BY public.purchases.id;


--
-- Name: reward_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reward_progress (
    id integer NOT NULL,
    scheme_id integer NOT NULL,
    customer_id integer NOT NULL,
    liters_achieved numeric(12,3) DEFAULT '0'::numeric NOT NULL,
    is_reward_achieved boolean DEFAULT false NOT NULL,
    is_disbursed boolean DEFAULT false NOT NULL,
    disbursed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: reward_progress_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.reward_progress_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: reward_progress_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.reward_progress_id_seq OWNED BY public.reward_progress.id;


--
-- Name: reward_schemes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reward_schemes (
    id integer NOT NULL,
    scheme_name text DEFAULT ''::text NOT NULL,
    product_id integer NOT NULL,
    target_liters numeric(12,3) NOT NULL,
    reward_type text NOT NULL,
    reward_value text NOT NULL,
    start_date timestamp with time zone NOT NULL,
    end_date timestamp with time zone NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: reward_schemes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.reward_schemes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: reward_schemes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.reward_schemes_id_seq OWNED BY public.reward_schemes.id;


--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_permissions (
    id integer NOT NULL,
    role text NOT NULL,
    feature text NOT NULL,
    allowed boolean DEFAULT true NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: role_permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.role_permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: role_permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.role_permissions_id_seq OWNED BY public.role_permissions.id;


--
-- Name: stock_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_movements (
    id integer NOT NULL,
    product_id integer NOT NULL,
    type text NOT NULL,
    quantity numeric(12,3) NOT NULL,
    reason text NOT NULL,
    reference_id integer,
    reference_type text,
    user_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: stock_movements_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stock_movements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stock_movements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.stock_movements_id_seq OWNED BY public.stock_movements.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username text NOT NULL,
    password_hash text NOT NULL,
    role text DEFAULT 'salesman'::text NOT NULL,
    name text NOT NULL,
    entity_id integer,
    company_id integer,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: worker_attendance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.worker_attendance (
    id integer NOT NULL,
    worker_id integer NOT NULL,
    date date NOT NULL,
    status text NOT NULL,
    wage_amount numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: worker_attendance_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.worker_attendance_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: worker_attendance_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.worker_attendance_id_seq OWNED BY public.worker_attendance.id;


--
-- Name: worker_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.worker_payments (
    id integer NOT NULL,
    worker_id integer NOT NULL,
    amount numeric(12,2) NOT NULL,
    paid_on date NOT NULL,
    payment_mode text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: worker_payments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.worker_payments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: worker_payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.worker_payments_id_seq OWNED BY public.worker_payments.id;


--
-- Name: workers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workers (
    id integer NOT NULL,
    name text NOT NULL,
    phone text,
    skill text,
    daily_wage numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    joined_at date,
    is_active boolean DEFAULT true NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: workers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.workers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: workers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.workers_id_seq OWNED BY public.workers.id;


--
-- Name: workload_cards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workload_cards (
    id integer NOT NULL,
    product_id integer NOT NULL,
    target_qty numeric(12,3) NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    worker_id integer,
    worker_name text,
    order_type text DEFAULT 'manual_order'::text NOT NULL,
    reference_order_id integer,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: workload_cards_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.workload_cards_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: workload_cards_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.workload_cards_id_seq OWNED BY public.workload_cards.id;


--
-- Name: account_transactions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_transactions ALTER COLUMN id SET DEFAULT nextval('public.account_transactions_id_seq'::regclass);


--
-- Name: accounts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts ALTER COLUMN id SET DEFAULT nextval('public.accounts_id_seq'::regclass);


--
-- Name: audit_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log ALTER COLUMN id SET DEFAULT nextval('public.audit_log_id_seq'::regclass);


--
-- Name: bom_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_items ALTER COLUMN id SET DEFAULT nextval('public.bom_items_id_seq'::regclass);


--
-- Name: boms id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boms ALTER COLUMN id SET DEFAULT nextval('public.boms_id_seq'::regclass);


--
-- Name: capital_snapshots id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capital_snapshots ALTER COLUMN id SET DEFAULT nextval('public.capital_snapshots_id_seq'::regclass);


--
-- Name: customer_order_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_order_items ALTER COLUMN id SET DEFAULT nextval('public.customer_order_items_id_seq'::regclass);


--
-- Name: customer_orders id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_orders ALTER COLUMN id SET DEFAULT nextval('public.customer_orders_id_seq'::regclass);


--
-- Name: entities id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entities ALTER COLUMN id SET DEFAULT nextval('public.entities_id_seq'::regclass);


--
-- Name: expense_categories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_categories ALTER COLUMN id SET DEFAULT nextval('public.expense_categories_id_seq'::regclass);


--
-- Name: expenses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses ALTER COLUMN id SET DEFAULT nextval('public.expenses_id_seq'::regclass);


--
-- Name: invoice_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_items ALTER COLUMN id SET DEFAULT nextval('public.invoice_items_id_seq'::regclass);


--
-- Name: invoice_sequence id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_sequence ALTER COLUMN id SET DEFAULT nextval('public.invoice_sequence_id_seq'::regclass);


--
-- Name: invoices id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices ALTER COLUMN id SET DEFAULT nextval('public.invoices_id_seq'::regclass);


--
-- Name: ledger_entries id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ledger_entries ALTER COLUMN id SET DEFAULT nextval('public.ledger_entries_id_seq'::regclass);


--
-- Name: payments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments ALTER COLUMN id SET DEFAULT nextval('public.payments_id_seq'::regclass);


--
-- Name: products id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products ALTER COLUMN id SET DEFAULT nextval('public.products_id_seq'::regclass);


--
-- Name: purchase_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_items ALTER COLUMN id SET DEFAULT nextval('public.purchase_items_id_seq'::regclass);


--
-- Name: purchase_sequence id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_sequence ALTER COLUMN id SET DEFAULT nextval('public.purchase_sequence_id_seq'::regclass);


--
-- Name: purchases id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchases ALTER COLUMN id SET DEFAULT nextval('public.purchases_id_seq'::regclass);


--
-- Name: reward_progress id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reward_progress ALTER COLUMN id SET DEFAULT nextval('public.reward_progress_id_seq'::regclass);


--
-- Name: reward_schemes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reward_schemes ALTER COLUMN id SET DEFAULT nextval('public.reward_schemes_id_seq'::regclass);


--
-- Name: role_permissions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions ALTER COLUMN id SET DEFAULT nextval('public.role_permissions_id_seq'::regclass);


--
-- Name: stock_movements id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements ALTER COLUMN id SET DEFAULT nextval('public.stock_movements_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: worker_attendance id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worker_attendance ALTER COLUMN id SET DEFAULT nextval('public.worker_attendance_id_seq'::regclass);


--
-- Name: worker_payments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worker_payments ALTER COLUMN id SET DEFAULT nextval('public.worker_payments_id_seq'::regclass);


--
-- Name: workers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workers ALTER COLUMN id SET DEFAULT nextval('public.workers_id_seq'::regclass);


--
-- Name: workload_cards id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workload_cards ALTER COLUMN id SET DEFAULT nextval('public.workload_cards_id_seq'::regclass);


--
-- Name: account_transactions account_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_transactions
    ADD CONSTRAINT account_transactions_pkey PRIMARY KEY (id);


--
-- Name: account_transactions account_transactions_receipt_no_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_transactions
    ADD CONSTRAINT account_transactions_receipt_no_unique UNIQUE (receipt_no);


--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: bom_items bom_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_items
    ADD CONSTRAINT bom_items_pkey PRIMARY KEY (id);


--
-- Name: boms boms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boms
    ADD CONSTRAINT boms_pkey PRIMARY KEY (id);


--
-- Name: capital_snapshots capital_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capital_snapshots
    ADD CONSTRAINT capital_snapshots_pkey PRIMARY KEY (id);


--
-- Name: capital_snapshots capital_snapshots_snapshot_date_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capital_snapshots
    ADD CONSTRAINT capital_snapshots_snapshot_date_unique UNIQUE (snapshot_date);


--
-- Name: customer_order_items customer_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_order_items
    ADD CONSTRAINT customer_order_items_pkey PRIMARY KEY (id);


--
-- Name: customer_orders customer_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_orders
    ADD CONSTRAINT customer_orders_pkey PRIMARY KEY (id);


--
-- Name: entities entities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entities
    ADD CONSTRAINT entities_pkey PRIMARY KEY (id);


--
-- Name: expense_categories expense_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_categories
    ADD CONSTRAINT expense_categories_pkey PRIMARY KEY (id);


--
-- Name: expenses expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_pkey PRIMARY KEY (id);


--
-- Name: invoice_items invoice_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_pkey PRIMARY KEY (id);


--
-- Name: invoice_sequence invoice_sequence_month_year_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_sequence
    ADD CONSTRAINT invoice_sequence_month_year_unique UNIQUE (month, year);


--
-- Name: invoice_sequence invoice_sequence_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_sequence
    ADD CONSTRAINT invoice_sequence_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_invoice_no_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_invoice_no_unique UNIQUE (invoice_no);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: ledger_entries ledger_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ledger_entries
    ADD CONSTRAINT ledger_entries_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: payments payments_receipt_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_receipt_id_unique UNIQUE (receipt_id);


--
-- Name: products products_item_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_item_code_unique UNIQUE (item_code);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: purchase_items purchase_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_items
    ADD CONSTRAINT purchase_items_pkey PRIMARY KEY (id);


--
-- Name: purchase_sequence purchase_sequence_month_year_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_sequence
    ADD CONSTRAINT purchase_sequence_month_year_unique UNIQUE (month, year);


--
-- Name: purchase_sequence purchase_sequence_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_sequence
    ADD CONSTRAINT purchase_sequence_pkey PRIMARY KEY (id);


--
-- Name: purchases purchases_bill_no_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchases
    ADD CONSTRAINT purchases_bill_no_unique UNIQUE (bill_no);


--
-- Name: purchases purchases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchases
    ADD CONSTRAINT purchases_pkey PRIMARY KEY (id);


--
-- Name: reward_progress reward_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reward_progress
    ADD CONSTRAINT reward_progress_pkey PRIMARY KEY (id);


--
-- Name: reward_schemes reward_schemes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reward_schemes
    ADD CONSTRAINT reward_schemes_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (id);


--
-- Name: stock_movements stock_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_unique UNIQUE (username);


--
-- Name: worker_attendance worker_attendance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worker_attendance
    ADD CONSTRAINT worker_attendance_pkey PRIMARY KEY (id);


--
-- Name: worker_payments worker_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worker_payments
    ADD CONSTRAINT worker_payments_pkey PRIMARY KEY (id);


--
-- Name: workers workers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workers
    ADD CONSTRAINT workers_pkey PRIMARY KEY (id);


--
-- Name: workload_cards workload_cards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workload_cards
    ADD CONSTRAINT workload_cards_pkey PRIMARY KEY (id);


--
-- Name: accounts_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX accounts_type_idx ON public.accounts USING btree (type);


--
-- Name: acct_txn_account_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX acct_txn_account_idx ON public.account_transactions USING btree (account_id);


--
-- Name: acct_txn_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX acct_txn_created_idx ON public.account_transactions USING btree (created_at);


--
-- Name: acct_txn_direction_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX acct_txn_direction_idx ON public.account_transactions USING btree (direction);


--
-- Name: audit_log_action_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_action_idx ON public.audit_log USING btree (action);


--
-- Name: audit_log_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_user_idx ON public.audit_log USING btree (user_id);


--
-- Name: bom_items_bom_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bom_items_bom_idx ON public.bom_items USING btree (bom_id);


--
-- Name: customer_order_items_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_order_items_order_idx ON public.customer_order_items USING btree (order_id);


--
-- Name: customer_orders_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_orders_status_idx ON public.customer_orders USING btree (status);


--
-- Name: customer_orders_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_orders_user_idx ON public.customer_orders USING btree (user_id);


--
-- Name: entities_mobile_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX entities_mobile_idx ON public.entities USING btree (mobile);


--
-- Name: entities_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX entities_type_idx ON public.entities USING btree (type);


--
-- Name: expense_categories_name_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX expense_categories_name_uq ON public.expense_categories USING btree (name);


--
-- Name: expenses_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX expenses_category_idx ON public.expenses USING btree (category_id);


--
-- Name: expenses_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX expenses_date_idx ON public.expenses USING btree (date);


--
-- Name: invoice_items_invoice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoice_items_invoice_idx ON public.invoice_items USING btree (invoice_id);


--
-- Name: invoices_customer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoices_customer_idx ON public.invoices USING btree (customer_id);


--
-- Name: invoices_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoices_date_idx ON public.invoices USING btree (invoice_date);


--
-- Name: invoices_salesman_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoices_salesman_idx ON public.invoices USING btree (salesman_id);


--
-- Name: ledger_entity_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ledger_entity_idx ON public.ledger_entries USING btree (entity_id);


--
-- Name: payments_customer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payments_customer_idx ON public.payments USING btree (customer_id);


--
-- Name: payments_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payments_status_idx ON public.payments USING btree (status);


--
-- Name: products_brand_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX products_brand_idx ON public.products USING btree (brand);


--
-- Name: products_deleted_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX products_deleted_at_idx ON public.products USING btree (deleted_at);


--
-- Name: products_group_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX products_group_idx ON public.products USING btree ("group");


--
-- Name: purchase_items_purchase_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX purchase_items_purchase_idx ON public.purchase_items USING btree (purchase_id);


--
-- Name: purchases_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX purchases_date_idx ON public.purchases USING btree (bill_date);


--
-- Name: purchases_vendor_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX purchases_vendor_idx ON public.purchases USING btree (vendor_id);


--
-- Name: reward_progress_scheme_customer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reward_progress_scheme_customer_idx ON public.reward_progress USING btree (scheme_id, customer_id);


--
-- Name: stock_movements_product_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stock_movements_product_idx ON public.stock_movements USING btree (product_id);


--
-- Name: worker_attendance_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX worker_attendance_date_idx ON public.worker_attendance USING btree (date);


--
-- Name: worker_attendance_worker_date_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX worker_attendance_worker_date_uq ON public.worker_attendance USING btree (worker_id, date);


--
-- Name: worker_payments_paid_on_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX worker_payments_paid_on_idx ON public.worker_payments USING btree (paid_on);


--
-- Name: worker_payments_worker_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX worker_payments_worker_idx ON public.worker_payments USING btree (worker_id);


--
-- Name: workers_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workers_active_idx ON public.workers USING btree (is_active);


--
-- Name: workload_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workload_status_idx ON public.workload_cards USING btree (status);


--
-- Name: account_transactions account_transactions_account_id_accounts_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_transactions
    ADD CONSTRAINT account_transactions_account_id_accounts_id_fk FOREIGN KEY (account_id) REFERENCES public.accounts(id);


--
-- Name: bom_items bom_items_bom_id_boms_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_items
    ADD CONSTRAINT bom_items_bom_id_boms_id_fk FOREIGN KEY (bom_id) REFERENCES public.boms(id) ON DELETE CASCADE;


--
-- Name: bom_items bom_items_material_product_id_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_items
    ADD CONSTRAINT bom_items_material_product_id_products_id_fk FOREIGN KEY (material_product_id) REFERENCES public.products(id);


--
-- Name: boms boms_finished_product_id_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boms
    ADD CONSTRAINT boms_finished_product_id_products_id_fk FOREIGN KEY (finished_product_id) REFERENCES public.products(id);


--
-- Name: customer_order_items customer_order_items_order_id_customer_orders_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_order_items
    ADD CONSTRAINT customer_order_items_order_id_customer_orders_id_fk FOREIGN KEY (order_id) REFERENCES public.customer_orders(id) ON DELETE CASCADE;


--
-- Name: expenses expenses_category_id_expense_categories_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_category_id_expense_categories_id_fk FOREIGN KEY (category_id) REFERENCES public.expense_categories(id) ON DELETE SET NULL;


--
-- Name: invoice_items invoice_items_invoice_id_invoices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_invoice_id_invoices_id_fk FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;


--
-- Name: invoice_items invoice_items_product_id_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_product_id_products_id_fk FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: invoices invoices_customer_id_entities_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_customer_id_entities_id_fk FOREIGN KEY (customer_id) REFERENCES public.entities(id);


--
-- Name: ledger_entries ledger_entries_entity_id_entities_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ledger_entries
    ADD CONSTRAINT ledger_entries_entity_id_entities_id_fk FOREIGN KEY (entity_id) REFERENCES public.entities(id);


--
-- Name: payments payments_customer_id_entities_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_customer_id_entities_id_fk FOREIGN KEY (customer_id) REFERENCES public.entities(id);


--
-- Name: purchase_items purchase_items_product_id_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_items
    ADD CONSTRAINT purchase_items_product_id_products_id_fk FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: purchase_items purchase_items_purchase_id_purchases_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_items
    ADD CONSTRAINT purchase_items_purchase_id_purchases_id_fk FOREIGN KEY (purchase_id) REFERENCES public.purchases(id) ON DELETE CASCADE;


--
-- Name: purchases purchases_vendor_id_entities_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchases
    ADD CONSTRAINT purchases_vendor_id_entities_id_fk FOREIGN KEY (vendor_id) REFERENCES public.entities(id);


--
-- Name: reward_progress reward_progress_customer_id_entities_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reward_progress
    ADD CONSTRAINT reward_progress_customer_id_entities_id_fk FOREIGN KEY (customer_id) REFERENCES public.entities(id);


--
-- Name: reward_progress reward_progress_scheme_id_reward_schemes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reward_progress
    ADD CONSTRAINT reward_progress_scheme_id_reward_schemes_id_fk FOREIGN KEY (scheme_id) REFERENCES public.reward_schemes(id);


--
-- Name: reward_schemes reward_schemes_product_id_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reward_schemes
    ADD CONSTRAINT reward_schemes_product_id_products_id_fk FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: stock_movements stock_movements_product_id_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_product_id_products_id_fk FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: worker_attendance worker_attendance_worker_id_workers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worker_attendance
    ADD CONSTRAINT worker_attendance_worker_id_workers_id_fk FOREIGN KEY (worker_id) REFERENCES public.workers(id) ON DELETE CASCADE;


--
-- Name: worker_payments worker_payments_worker_id_workers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worker_payments
    ADD CONSTRAINT worker_payments_worker_id_workers_id_fk FOREIGN KEY (worker_id) REFERENCES public.workers(id) ON DELETE CASCADE;


--
-- Name: workload_cards workload_cards_product_id_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workload_cards
    ADD CONSTRAINT workload_cards_product_id_products_id_fk FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- PostgreSQL database dump complete
--

\unrestrict 2P7W0ZsnQ0vcLzRhLbTMvcDGEkeDiz5ElEbeJwrLW1bMBxlLAylc2WaeMA9p2NX


--
-- SaaS Subscription Management module tables
--

CREATE TABLE IF NOT EXISTS public.companies (
    id SERIAL PRIMARY KEY,
    name text NOT NULL,
    owner_name text,
    mobile text,
    email text,
    logo text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.subscriptions (
    id SERIAL PRIMARY KEY,
    company_id integer NOT NULL,
    plan_name text NOT NULL,
    subscription_start_date timestamp with time zone NOT NULL,
    subscription_end_date timestamp with time zone NOT NULL,
    subscription_amount numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    payment_status text DEFAULT 'pending'::text NOT NULL,
    subscription_status text DEFAULT 'active'::text NOT NULL,
    last_payment_date timestamp with time zone,
    next_due_date timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS subscription_company_unique ON public.subscriptions (company_id);

CREATE TABLE IF NOT EXISTS public.subscription_alerts (
    id SERIAL PRIMARY KEY,
    company_id integer NOT NULL,
    subscription_id integer NOT NULL,
    alert_type text NOT NULL,
    message text NOT NULL,
    days_remaining integer DEFAULT 0 NOT NULL,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS subscription_alert_sub_idx ON public.subscription_alerts (subscription_id);
CREATE UNIQUE INDEX IF NOT EXISTS subscription_alert_type_unique ON public.subscription_alerts (subscription_id, alert_type);

CREATE TABLE IF NOT EXISTS public.app_settings (
    key text PRIMARY KEY,
    value text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.number_series (
    series_type text PRIMARY KEY,
    prefix text DEFAULT '' NOT NULL,
    include_year boolean DEFAULT true NOT NULL,
    include_month boolean DEFAULT true NOT NULL,
    year_format text DEFAULT 'calendar'::text NOT NULL,
    separator text DEFAULT '/'::text NOT NULL,
    padding integer DEFAULT 0 NOT NULL,
    start_number integer DEFAULT 1 NOT NULL,
    next_number integer DEFAULT 1 NOT NULL,
    reset_rule text DEFAULT 'monthly'::text NOT NULL,
    period_key text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


-- Default admin user (plaintext password by current app design: plain === hash)
INSERT INTO public.users (username, password_hash, role, name, is_active)
VALUES ('admin', 'admin123', 'admin', 'Administrator', true)
ON CONFLICT (username) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.print_settings (
    id serial PRIMARY KEY,
    company_id integer NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS print_settings_company_uq ON public.print_settings (company_id);
