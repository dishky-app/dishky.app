/**
 * PaymentDetails.js  —  Dishky Admin Panel
 * Single payment record detail view. Read-only — status here reflects
 * whatever Razorpay's webhook has reported (see server/payments.js);
 * there's no manual "mark as paid" action any more. Follows the same
 * shared details-page shell (details-container/details-header/section)
 * used by DishDetails.js and the events details pages, and the same
 * "use navigate-state data immediately, fetch only as a refresh/
 * fallback" pattern used by MemoDetails.js.
 */

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";

import { QRCodeSVG } from "qrcode.react";
import api from "../api";
import { formatDisplayDate } from "../App";
import { useToast } from "../useToast";
import Button3D from "../components/Button3D";
import PageLoader from "../components/PageLoader";

import "./Payments.css";

const STATUS_BADGE_CLASS = {
  PENDING: "pay-status-pending",
  PAID: "pay-status-paid",
  FAILED: "pay-status-failed",
};

const PaymentDetails = () => {
  const { paymentId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const paymentFromState = location.state?.payment || null;

  const [payment, setPayment] = useState(paymentFromState);
  const [isLoading, setIsLoading] = useState(!paymentFromState);
  const [notFound, setNotFound] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get(`/payments/${paymentId}`);
      setPayment(res.data);
    } catch (err) {
      if (err?.response?.status === 404) setNotFound(true);
      else {
        console.error("Failed to load payment:", err);
        toast.error("Failed to load payment");
      }
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentId]);

  useEffect(() => {
    if (paymentFromState && paymentFromState.id === paymentId) {
      setPayment(paymentFromState);
      setIsLoading(false);
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await api.get(`/payments/${paymentId}`);
      setPayment(res.data);
      toast.success("Status refreshed");
    } catch (err) {
      toast.error("Failed to refresh status");
    } finally {
      setRefreshing(false);
    }
  };

  if (isLoading) {
    return <div className="details-container"><PageLoader fill label="Loading payment…" /></div>;
  }
  if (notFound || !payment) {
    return (
      <div className="details-container">
        <div className="details-header">
          <button className="back-btn" onClick={() => navigate("/payments")} />
          <h2>Payment Not Found</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="details-container">
      {/* HEADER */}
      <div className="details-header">
        <button type="button" className="back-btn" onClick={() => navigate(-1)}></button>
        <h2>{payment.id}</h2>
        <span className={`pay-status-badge ${STATUS_BADGE_CLASS[payment.status] || ""}`}>
          {payment.status}
        </span>
        {payment.status === "PENDING" && (
          <Button3D variant="cancel" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? "Refreshing…" : "Refresh Status"}
          </Button3D>
        )}
      </div>

      <div className="details-body">

        {payment.status === "FAILED" && payment.failureReason && (
          <div className="section">
            <div className="section-title"><span>Failure Reason</span></div>
            <p className="pay-details-failure-box">{payment.failureReason}</p>
          </div>
        )}

        <div className="horizontal-form-group">
          <div className="section">
            <div className="section-title"><span>Order</span></div>
            <p>
              <span className="clickable" onClick={() => navigate(`/orders`, { state: { highlightOrderId: payment.orderId } })}>
                {payment.orderId}
              </span>
              {payment.billNo ? ` — Bill ${payment.billNo}` : ""}
            </p>
          </div>
          <div className="section">
            <div className="section-title"><span>Amount</span></div>
            <p>₹{Number(payment.amount || 0).toLocaleString("en-IN")}</p>
          </div>
        </div>

        <div className="horizontal-form-group">
          <div className="section">
            <div className="section-title"><span>Method</span></div>
            <p>{payment.method ? payment.method.toUpperCase() : "—"}</p>
          </div>
          <div className="section">
            <div className="section-title"><span>Payer VPA</span></div>
            <p>{payment.vpa || "—"}</p>
          </div>
        </div>

        <div className="horizontal-form-group">
          <div className="section">
            <div className="section-title"><span>Created</span></div>
            <p>{formatDisplayDate(payment.createdAt)}</p>
          </div>
          <div className="section">
            <div className="section-title"><span>Confirmed</span></div>
            <p>{payment.confirmedAt ? formatDisplayDate(payment.confirmedAt) : "—"}</p>
          </div>
        </div>

        <div className="section">
          <div className="section-title"><span>{payment.source === "link" ? "Razorpay Payment Link ID" : "Razorpay QR ID"}</span></div>
          <p className="pay-details-mono">{payment.razorpayQrId}</p>
        </div>

        {payment.razorpayPaymentId && (
          <div className="section">
            <div className="section-title"><span>Razorpay Payment ID</span></div>
            <p className="pay-details-mono">{payment.razorpayPaymentId}</p>
          </div>
        )}

        {payment.status === "PENDING" && (payment.qrImageUrl || payment.qrImageContent) && (
          <div className="section">
            <div className="section-title"><span>UPI QR Code</span></div>
            <div className="pay-details-qr-wrap">
              {payment.qrImageUrl
                ? <img src={payment.qrImageUrl} alt="UPI QR code" className="pay-details-qr-img" />
                : <QRCodeSVG value={payment.qrImageContent} size={200} />}
              <p style={{ color: "#666", fontSize: 13 }}>Waiting for the customer to scan and pay.</p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default PaymentDetails;
