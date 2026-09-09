import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, Boolean, ForeignKey, Numeric, Text, Enum
from sqlalchemy.orm import relationship
from app.database import Base

class User(Base):
    __tablename__ = "User"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    fullName = Column(String, default="")
    email = Column(String, unique=True, nullable=False)
    phone = Column(String, nullable=True)
    passwordHash = Column(String, nullable=False)
    role = Column(String, default="USER")
    resetToken = Column(String, nullable=True)
    resetTokenExp = Column(DateTime, nullable=True)
    createdAt = Column(DateTime, default=datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    emailVerified = Column(DateTime, nullable=True)
    image = Column(String, nullable=True)
    name = Column(String, nullable=True)
    stripeCustomerId = Column(String, unique=True, nullable=True)

    orders = relationship("Order", back_populates="user")
    notifications = relationship("Notification", back_populates="user")

class Category(Base):
    __tablename__ = "Category"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, unique=True, nullable=False)
    slug = Column(String, unique=True, nullable=False)
    createdAt = Column(DateTime, default=datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    products = relationship("Product", back_populates="category")

class Product(Base):
    __tablename__ = "Product"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    price = Column(Numeric(10, 2), nullable=False)
    image = Column(String, nullable=False)
    color = Column(String, nullable=True)
    size = Column(String, nullable=True)
    stock = Column(Integer, default=100)
    isActive = Column(Boolean, default=True)
    categoryId = Column(String, ForeignKey("Category.id"), nullable=True)
    createdAt = Column(DateTime, default=datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    category = relationship("Category", back_populates="products")
    images = relationship("ProductImage", back_populates="product", cascade="all, delete-orphan")
    specifications = relationship("Specification", back_populates="product", cascade="all, delete-orphan")
    orderItems = relationship("OrderItem", back_populates="product")

class ProductImage(Base):
    __tablename__ = "ProductImage"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    url = Column(String, nullable=False)
    color = Column(String, default="")
    sortOrder = Column(Integer, default=0)
    productId = Column(String, ForeignKey("Product.id"), nullable=False)

    product = relationship("Product", back_populates="images")

class Specification(Base):
    __tablename__ = "Specification"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    color = Column(String, nullable=False)
    size = Column(String, nullable=False)
    qty = Column(Integer, default=0)
    productId = Column(String, ForeignKey("Product.id"), nullable=False)

    product = relationship("Product", back_populates="specifications")

class CartItem(Base):
    __tablename__ = "CartItem"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    quantity = Column(Integer, default=1)
    userId = Column(String, ForeignKey("User.id"), nullable=False)
    productId = Column(String, ForeignKey("Product.id"), nullable=False)
    specificationId = Column(String, nullable=True)
    createdAt = Column(DateTime, default=datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Order(Base):
    __tablename__ = "Order"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    orderNumber = Column(Integer, unique=True, nullable=False)
    userId = Column(String, ForeignKey("User.id"), nullable=False)
    status = Column(String, default="PENDING")
    paymentMethod = Column(String, default="CARD")
    paymentStatus = Column(String, default="PENDING")
    stripePaymentIntentId = Column(String, nullable=True)
    stripeClientSecret = Column(String, nullable=True)
    subTotal = Column(Numeric(10, 2), nullable=False)
    tax = Column(Numeric(10, 2), nullable=False)
    total = Column(Numeric(10, 2), nullable=False)
    shippingFullName = Column(String, nullable=True)
    shippingEmail = Column(String, nullable=True)
    shippingPhone = Column(String, nullable=True)
    shippingAddress = Column(String, nullable=True)
    shippingCity = Column(String, nullable=True)
    shippingPostalCode = Column(String, nullable=True)
    paymentAttemptCount = Column(Integer, default=0)
    maxPaymentAttempts = Column(Integer, default=3)
    nextPaymentRetryAt = Column(DateTime, nullable=True)
    lastFailedPaymentIntentId = Column(String, nullable=True)
    createdAt = Column(DateTime, default=datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")

class OrderItem(Base):
    __tablename__ = "OrderItem"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    quantity = Column(Integer, nullable=False)
    price = Column(Numeric(10, 2), nullable=False)
    color = Column(String, nullable=True)
    size = Column(String, nullable=True)
    orderId = Column(String, ForeignKey("Order.id"), nullable=False)
    productId = Column(String, ForeignKey("Product.id"), nullable=False)
    specificationId = Column(String, nullable=True)

    order = relationship("Order", back_populates="items")
    product = relationship("Product", back_populates="orderItems")

class Notification(Base):
    __tablename__ = "Notification"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    userId = Column(String, ForeignKey("User.id"), nullable=False)
    title = Column(String, nullable=False)
    message = Column(String, nullable=False)
    orderId = Column(String, nullable=True)
    read = Column(Boolean, default=False)
    createdAt = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="notifications")
