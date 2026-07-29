import numpy as np
import random
from typing import Any, Dict, List, Tuple
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import GradientBoostingClassifier, VotingClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import cross_val_score

# Feature Categories
SOURCES = ['Website', 'Referral', 'Cold Reachout', 'Event']
INDUSTRIES = ['Technology', 'Healthcare', 'Finance', 'Defense', 'Education', 'Manufacturing', 'Retail']
COUNTRIES = ['USA', 'Canada', 'UK', 'Germany', 'India', 'Others']
STATUSES = ['New', 'Contacted', 'Qualified', 'Lost']

# Industry value multipliers (synthetic ground truth)
INDUSTRY_WEIGHTS = {
    'Technology': 1.4, 'Defense': 1.3, 'Finance': 1.2,
    'Healthcare': 1.0, 'Manufacturing': 0.9, 'Retail': 0.8, 'Education': 0.6
}

SOURCE_WEIGHTS = {
    'Referral': 1.8, 'Website': 1.0, 'Event': 0.9, 'Cold Reachout': 0.5
}

class LeadScoringModel:
    def __init__(self):
        # Ensemble: LogisticRegression + GradientBoosting
        lr = LogisticRegression(C=1.0, max_iter=1000)
        gb = GradientBoostingClassifier(
            n_estimators=100, max_depth=4, learning_rate=0.1, random_state=42
        )
        self.model = VotingClassifier(
            estimators=[('lr', lr), ('gb', gb)],
            voting='soft',
            weights=[0.3, 0.7]
        )
        self.scaler = StandardScaler()
        self.is_trained = False
        self.feature_names: List[str] = []
        self.feature_means: Dict[str, float] = {}
        self.cv_score: float = 0.0

    def _extract_features(self, lead_dict: dict) -> np.ndarray:
        """Converts a Lead dictionary into a flat 1D feature array."""
        feat_dict = {}

        # 1. Source one-hot
        source = lead_dict.get("source") or "Website"
        for s in SOURCES:
            feat_dict[f"source_{s}"] = 1.0 if source == s else 0.0

        # 2. Industry one-hot
        industry = lead_dict.get("industry") or "Technology"
        for ind in INDUSTRIES:
            feat_dict[f"industry_{ind}"] = 1.0 if industry == ind else 0.0

        # 3. Country one-hot
        country = lead_dict.get("country") or "USA"
        for c in COUNTRIES:
            feat_dict[f"country_{c}"] = 1.0 if country == c else 0.0

        # 4. Status one-hot
        status = lead_dict.get("status") or "New"
        for st in STATUSES:
            feat_dict[f"status_{st}"] = 1.0 if status == st else 0.0

        # 5. Employee count (log scale)
        emp_count = lead_dict.get("employee_count") or 100
        feat_dict["employee_count_log"] = float(np.log1p(max(0, emp_count)))

        # 6. Has website flag
        website = lead_dict.get("website") or ""
        feat_dict["has_website"] = 1.0 if website.strip() else 0.0

        # 7. Has email flag
        email = lead_dict.get("email") or ""
        feat_dict["has_email"] = 1.0 if email.strip() else 0.0

        # 8. Has phone flag
        phone = lead_dict.get("phone") or ""
        feat_dict["has_phone"] = 1.0 if phone.strip() else 0.0

        # 9. Notes length (proxy for engagement level)
        notes = lead_dict.get("notes") or ""
        feat_dict["notes_length_log"] = float(np.log1p(len(notes)))

        # 10. Source weight (continuous feature)
        feat_dict["source_weight"] = SOURCE_WEIGHTS.get(source, 0.7)

        # 11. Industry weight (continuous feature)
        feat_dict["industry_weight"] = INDUSTRY_WEIGHTS.get(industry, 0.8)

        # Build ordered vector
        vector = []
        for name in self.feature_names:
            vector.append(feat_dict.get(name, 0.0))

        return np.array(vector)

    def _generate_synthetic_data(self, count: int = 500) -> Tuple[np.ndarray, np.ndarray]:
        """Generates synthetic won/lost leads with realistic heuristics."""
        # Establish feature name ordering
        self.feature_names = []
        for s in SOURCES:
            self.feature_names.append(f"source_{s}")
        for ind in INDUSTRIES:
            self.feature_names.append(f"industry_{ind}")
        for c in COUNTRIES:
            self.feature_names.append(f"country_{c}")
        for st in STATUSES:
            self.feature_names.append(f"status_{st}")
        self.feature_names.extend([
            "employee_count_log", "has_website", "has_email", "has_phone",
            "notes_length_log", "source_weight", "industry_weight"
        ])

        X_list = []
        y_list = []

        for _ in range(count):
            source = random.choice(SOURCES)
            industry = random.choice(INDUSTRIES)
            country = random.choice(COUNTRIES)
            status = random.choice(STATUSES)
            emp_count = int(random.lognormvariate(4.5, 1.2))
            has_website = random.random() < 0.7
            has_email = random.random() < 0.85
            has_phone = random.random() < 0.6
            notes_len = int(random.lognormvariate(3.0, 1.5))

            # Ground truth likelihood
            score = 0.0
            score += SOURCE_WEIGHTS.get(source, 0.7) - 1.0
            score += INDUSTRY_WEIGHTS.get(industry, 0.8) - 1.0

            if emp_count > 500:
                score += 0.8
            elif emp_count < 20:
                score -= 0.5

            if has_website:
                score += 0.3
            if has_email:
                score += 0.2
            if has_phone:
                score += 0.2

            if notes_len > 50:
                score += 0.4

            if status == 'Qualified':
                score += 1.5
            elif status == 'Contacted':
                score += 0.5
            elif status == 'Lost':
                score -= 2.0

            if country in ['USA', 'Canada', 'UK']:
                score += 0.2

            # Add noise
            score += random.normalvariate(0.0, 0.6)

            # Sigmoid to probability
            prob = 1 / (1 + np.exp(-score))
            y = 1 if random.random() < prob else 0

            lead_dict = {
                "source": source, "industry": industry, "country": country,
                "status": status, "employee_count": emp_count,
                "website": "example.com" if has_website else "",
                "email": "user@example.com" if has_email else "",
                "phone": "+15550000" if has_phone else "",
                "notes": "x" * notes_len
            }

            X_list.append(self._extract_features(lead_dict))
            y_list.append(y)

        return np.array(X_list), np.array(y_list)

    def train(self):
        """Generates synthetic data, fits the ensemble, and stores metadata."""
        print("Training AI Lead Scoring ML Pipeline (Ensemble: LR + GBM)...")
        X, y = self._generate_synthetic_data(500)

        # Scale features
        X_scaled = self.scaler.fit_transform(X)

        # Calculate feature means for SHAP-style attributions
        means = np.mean(X, axis=0)
        for i, name in enumerate(self.feature_names):
            self.feature_means[name] = float(means[i])

        # Cross-validation score
        try:
            scores = cross_val_score(self.model, X_scaled, y, cv=5, scoring='accuracy')
            self.cv_score = round(float(scores.mean()), 3)
            print(f"Cross-validation accuracy: {self.cv_score:.1%}")
        except Exception:
            self.cv_score = 0.0

        # Fit on full data
        self.model.fit(X_scaled, y)
        self.is_trained = True
        print(f"AI Lead Scoring model trained successfully. Features: {len(self.feature_names)}")

    def predict_score(self, lead_dict: dict) -> float:
        """Predicts probability (0-100) of winning the lead."""
        if not self.is_trained:
            self.train()

        x = self._extract_features(lead_dict).reshape(1, -1)
        x_scaled = self.scaler.transform(x)
        prob = self.model.predict_proba(x_scaled)[0][1]
        return round(float(prob) * 100, 1)

    def explain_score(self, lead_dict: dict) -> List[Dict[str, Any]]:
        """Calculates feature attributions using coefficient-based SHAP approximation."""
        if not self.is_trained:
            self.train()

        x = self._extract_features(lead_dict)

        # Use the LogisticRegression coefficients for interpretability
        lr_model = self.model.named_estimators_['lr']
        coefs = lr_model.coef_[0]

        contributions = []
        for i, name in enumerate(self.feature_names):
            val = x[i]
            mean = self.feature_means.get(name, 0.0)
            weight = coefs[i]

            # Attribution = weight * (value - mean), scaled to score range
            attribution = weight * (val - mean)
            if abs(attribution) > 0.02:
                contributions.append({
                    "feature": name,
                    "attribution": round(float(attribution) * 15, 1),
                    "value": round(float(val), 3)
                })

        contributions.sort(key=lambda item: abs(item["attribution"]), reverse=True)
        return contributions[:8]  # Top 8 factors

# Global Singleton Model
scoring_model = LeadScoringModel()
