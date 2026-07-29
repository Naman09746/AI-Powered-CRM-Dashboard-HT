from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import engine, Base, SessionLocal
from app.core.security import get_password_hash
from app.models.user import User
from app.models.crm import Lead, Deal, Company, Contact, Activity, Prospect, OutreachResult, OutreachFollowUp, OutreachSendLog
from app.routers import auth, leads, deals, dashboard, tasks, notifications, reports, ai, advanced_ai, companies, users, outreach

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Set all CORS enabled origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_origin_regex=".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(leads.router, prefix=settings.API_V1_STR)
app.include_router(deals.router, prefix=settings.API_V1_STR)
app.include_router(dashboard.router, prefix=settings.API_V1_STR)
app.include_router(tasks.router, prefix=settings.API_V1_STR)
app.include_router(notifications.router, prefix=settings.API_V1_STR)
app.include_router(reports.router, prefix=settings.API_V1_STR)
app.include_router(ai.router, prefix=settings.API_V1_STR)
app.include_router(advanced_ai.router, prefix=settings.API_V1_STR)
app.include_router(companies.router, prefix=settings.API_V1_STR)
app.include_router(users.router, prefix=settings.API_V1_STR)
app.include_router(outreach.router, prefix=settings.API_V1_STR)




def seed_db(db: Session):
    # Check if we already have users
    if db.query(User).first():
        return
        
    print("Seeding database...")
    
    # 1. Create Users
    admin_pw = get_password_hash("Admin123!")
    manager_pw = get_password_hash("Manager123!")
    exec_pw = get_password_hash("Exec123!")
    
    admin = User(email="admin@crm.com", hashed_password=admin_pw, full_name="Rohit Admin", role="Admin")
    manager = User(email="manager@crm.com", hashed_password=manager_pw, full_name="Priya Manager", role="Manager")
    exec1 = User(email="exec@crm.com", hashed_password=exec_pw, full_name="Rahul Executive", role="Executive")
    
    db.add_all([admin, manager, exec1])
    db.commit()
    db.refresh(admin)
    db.refresh(manager)
    db.refresh(exec1)
    
    # 2. Create Companies
    techcorp = Company(name="TechCorp Solutions", industry="Technology", website="techcorp.io", employee_count=250)
    healthinc = Company(name="HealthInc Group", industry="Healthcare", website="healthinc.com", employee_count=1200)
    financeflow = Company(name="FinanceFlow Co", industry="Finance", website="financeflow.com", employee_count=50)
    
    db.add_all([techcorp, healthinc, financeflow])
    db.commit()
    db.refresh(techcorp)
    db.refresh(healthinc)
    db.refresh(financeflow)

    # 3. Create Contacts
    c1 = Contact(name="John Doe", email="johndoe@techcorp.io", phone="+15550192", company_id=techcorp.id)
    c2 = Contact(name="Sarah Connor", email="sconnor@healthinc.com", phone="+15559812", company_id=healthinc.id)
    
    db.add_all([c1, c2])
    
    # 4. Create Leads
    l1 = Lead(
        name="John Doe",
        company_name="TechCorp Solutions",
        industry="Technology",
        website="techcorp.io",
        email="johndoe@techcorp.io",
        phone="+15550192",
        country="USA",
        employee_count=250,
        source="Website",
        status="Qualified",
        owner_id=exec1.id,
        notes="Interested in cloud infrastructure migration.",
        lead_score=85.0
    )
    l2 = Lead(
        name="Sarah Connor",
        company_name="HealthInc Group",
        industry="Healthcare",
        website="healthinc.com",
        email="sconnor@healthinc.com",
        phone="+15559812",
        country="Canada",
        employee_count=1200,
        source="Referral",
        status="Contacted",
        owner_id=exec1.id,
        notes="Evaluating EHR software options.",
        lead_score=60.0
    )
    l3 = Lead(
        name="Bruce Wayne",
        company_name="Wayne Enterprises",
        industry="Defense",
        website="waynecorp.com",
        email="bwayne@waynecorp.com",
        phone="+15550000",
        country="USA",
        employee_count=10000,
        source="Cold Reachout",
        status="New",
        owner_id=manager.id,
        notes="High potential client, needs bespoke analytics dashboard.",
        lead_score=95.0
    )
    l4 = Lead(
        name="Diana Prince",
        company_name="Themyscira Museum",
        industry="Education",
        website="themyscira.org",
        email="diana@themyscira.org",
        phone="+15557777",
        country="Greece",
        employee_count=15,
        source="Event",
        status="Lost",
        owner_id=admin.id,
        notes="Not interested at this time.",
        lead_score=15.0
    )
    
    db.add_all([l1, l2, l3, l4])
    db.commit()
    db.refresh(l1)
    db.refresh(l2)
    db.refresh(l3)
    db.refresh(l4)

    # 5. Create Deals
    d1 = Deal(title="Cloud Migration Contract", value=45000.0, stage="Negotiation", lead_id=l1.id, owner_id=exec1.id)
    d2 = Deal(title="EHR Software Implementation", value=120000.0, stage="Proposal", lead_id=l2.id, owner_id=exec1.id)
    d3 = Deal(title="Bespoke Analytics Platform", value=250000.0, stage="Won", lead_id=l3.id, owner_id=manager.id)
    d4 = Deal(title="Museum Digitization", value=15000.0, stage="Lost", lead_id=l4.id, owner_id=admin.id)
    
    db.add_all([d1, d2, d3, d4])
    db.commit()

    # 6. Activities
    act1 = Activity(type="Call", description="Initial discovery call with John.", lead_id=l1.id, user_id=exec1.id)
    act2 = Activity(type="Email", description="Sent proposal deck to Sarah.", lead_id=l2.id, user_id=exec1.id)
    db.add_all([act1, act2])
    
    db.commit()
    print("Database seeding completed successfully.")

def seed_outreach_demo(db: Session):
    if db.query(Prospect).first():
        return

    exec_user = db.query(User).filter(User.email == "exec@crm.com").first()
    manager = db.query(User).filter(User.email == "manager@crm.com").first()
    owner_id = exec_user.id if exec_user else (manager.id if manager else None)
    prospects = [
        Prospect(
            company_name="NCR Retail Mart",
            contact_name="Amit Verma",
            category="Retail",
            industry="Retail",
            location="Noida, Delhi NCR",
            country="India",
            website="ncrretail.example",
            email="amit@ncrretail.example",
            phone="+91 98765 43210",
            employee_count=45,
            source="Demo CSV Import",
            notes="Looking for inventory automation, online catalogue, and repeat-customer campaigns.",
            owner_id=owner_id,
        ),
        Prospect(
            company_name="BrightPath Coaching",
            contact_name="Neha Sharma",
            category="Education",
            industry="Education",
            location="Gurugram",
            country="India",
            website="brightpath.example",
            email="hello@brightpath.example",
            phone="+91 98111 22000",
            employee_count=18,
            source="Demo Prospect List",
            notes="Needs a better website, lead capture forms, and SEO for local admissions.",
            owner_id=owner_id,
        ),
        Prospect(
            company_name="MetroCare Diagnostics",
            contact_name="Operations Head",
            category="Healthcare",
            industry="Healthcare",
            location="Delhi",
            country="India",
            website="metrocare.example",
            email="ops@metrocare.example",
            phone="+91 99999 10010",
            employee_count=120,
            source="Demo Prospect List",
            notes="Manual appointment workflows and reporting gaps across branches.",
            owner_id=owner_id,
        ),
        Prospect(
            company_name="Artisan Homes Studio",
            contact_name="Priya Kapoor",
            category="Interior Design",
            industry="Services",
            location="Faridabad",
            country="India",
            website=None,
            email=None,
            phone="+91 90000 12121",
            employee_count=9,
            source="Demo Prospect List",
            notes="Instagram-led business; likely needs website portfolio and inquiry tracking.",
            owner_id=owner_id,
        ),
    ]
    db.add_all(prospects)
    db.commit()
    print("Outreach demo prospects seeded successfully.")

def check_and_fix_outreach_tables(db: Session):
    try:
        db.query(Prospect).first()
    except Exception as e:
        db.rollback()
        print(f"Repairing outreach tables due to schema update: {e}")
        try:
            OutreachSendLog.__table__.drop(bind=engine, checkfirst=True)
            OutreachFollowUp.__table__.drop(bind=engine, checkfirst=True)
            OutreachResult.__table__.drop(bind=engine, checkfirst=True)
            Prospect.__table__.drop(bind=engine, checkfirst=True)
        except Exception:
            pass
        Base.metadata.create_all(bind=engine)

@app.on_event("startup")
def startup_event():
    # Automatically create tables in SQLite/PostgreSQL
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        check_and_fix_outreach_tables(db)
        from app.seed_synthetic_data import seed_synthetic_crm_data
        seed_synthetic_crm_data(db)
        # Train ML model and score initial leads
        from app.core.ml import scoring_model
        from app.models.crm import Lead
        scoring_model.train()
        leads = db.query(Lead).all()
        for lead in leads:
            lead_dict = {
                "source": lead.source,
                "industry": lead.industry,
                "country": lead.country,
                "employee_count": lead.employee_count
            }
            lead.lead_score = scoring_model.predict_score(lead_dict)
            db.add(lead)
        db.commit()
        print("Initial ML Lead Scores calculated successfully.")
    finally:
        db.close()


@app.get("/")
def read_root():
    return {"message": "Welcome to AI-Powered CRM API", "status": "running"}
